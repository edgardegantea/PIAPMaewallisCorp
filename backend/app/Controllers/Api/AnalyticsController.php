<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

/**
 * Advanced analytics endpoints.
 *
 * GET /api/projects/:id/cfd              Cumulative Flow Diagram
 * GET /api/projects/:id/lead-time        Lead time & cycle time per sprint
 * GET /api/projects/:id/risk-matrix      Risk matrix data
 * GET /api/projects/:id/velocity-trend   Velocity trend across sprints
 * GET /api/projects/:id/profitability    Revenue vs cost
 */
class AnalyticsController extends BaseController
{
    /** Cumulative Flow Diagram — tasks per status per day (last 60 days) */
    public function cfd(int $projectId): ResponseInterface
    {
        $db   = Database::connect();
        $days = (int)($this->request->getGet('days') ?? 60);

        // Use audit_logs to reconstruct status changes
        // For each day, count tasks in each status at end-of-day
        $changes = $db->query("
            SELECT
                DATE(al.created_at) AS day,
                al.new_value        AS new_status,
                al.old_value        AS old_status,
                al.entity_id        AS task_id
            FROM audit_logs al
            JOIN tasks   t ON t.id = al.entity_id
            JOIN sprints s ON s.id = t.sprint_id
            WHERE al.entity_type = 'task'
              AND al.action = 'status_changed'
              AND s.project_id = ?
              AND al.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            ORDER BY al.created_at ASC
        ", [$projectId, $days])->getResultArray();

        // Current snapshot (tasks and their current status)
        $current = $db->query("
            SELECT t.id, t.status, t.created_at
            FROM tasks t JOIN sprints s ON s.id = t.sprint_id
            WHERE s.project_id = ? AND t.parent_task_id IS NULL
        ", [$projectId])->getResultArray();

        $statuses = ['PENDIENTE', 'EN_PROGRESO', 'BLOQUEADA', 'COMPLETADA'];

        // Build daily snapshot: start from current and walk backwards isn't
        // practical without full history. Instead, use today's snapshot +
        // changes to project forward from oldest audit record.

        // Simple approach: return aggregated counts by day from audit_logs
        $byDay = [];
        $start = new \DateTime("-{$days} days");
        $end   = new \DateTime();
        $cur   = clone $start;
        while ($cur <= $end) {
            $d = $cur->format('Y-m-d');
            $byDay[$d] = array_fill_keys($statuses, 0);
            $cur->modify('+1 day');
        }

        // Count tasks that were moved INTO each status on each day
        foreach ($changes as $c) {
            $day = $c['day'];
            if (isset($byDay[$day])) {
                $ns = trim($c['new_status'] ?? '', '"');
                if (isset($byDay[$day][$ns])) $byDay[$day][$ns]++;
            }
        }

        // Build running totals (cumulative)
        $result   = [];
        $running  = array_fill_keys($statuses, 0);
        foreach ($byDay as $day => $counts) {
            foreach ($statuses as $s) $running[$s] += $counts[$s];
            $result[] = array_merge(['date' => $day], $running);
        }

        return $this->response->setJSON($result);
    }

    /** Lead time and cycle time per sprint */
    public function leadTime(int $projectId): ResponseInterface
    {
        $db = Database::connect();

        $rows = $db->query("
            SELECT
                s.id AS sprint_id, s.name AS sprint_name, s.number,
                ROUND(AVG(
                    DATEDIFF(
                        CASE WHEN t.status = 'COMPLETADA' THEN t.updated_at ELSE NOW() END,
                        t.created_at
                    )
                ), 1) AS avg_lead_time_days,
                ROUND(AVG(
                    CASE WHEN t.status = 'COMPLETADA'
                    THEN DATEDIFF(t.updated_at, t.created_at) END
                ), 1) AS avg_cycle_time_days,
                COUNT(*) AS total_tasks,
                SUM(t.status = 'COMPLETADA') AS completed_tasks
            FROM sprints s
            JOIN tasks t ON t.sprint_id = s.id AND t.parent_task_id IS NULL
            WHERE s.project_id = ?
            GROUP BY s.id
            ORDER BY s.number ASC
        ", [$projectId])->getResultArray();

        return $this->response->setJSON($rows);
    }

    /** Risk matrix data — probability × impact grid */
    public function riskMatrix(int $projectId): ResponseInterface
    {
        $db   = Database::connect();
        $rows = $db->query("
            SELECT id, description, probability, impact, status, category
            FROM risks WHERE project_id = ? ORDER BY created_at DESC
        ", [$projectId])->getResultArray();

        $levels    = ['BAJA', 'MEDIA', 'ALTA'];
        $matrix    = [];
        foreach ($levels as $prob) {
            foreach ($levels as $imp) {
                $matrix["{$prob}:{$imp}"] = [];
            }
        }
        foreach ($rows as $r) {
            $key = ($r['probability'] ?? 'BAJA') . ':' . ($r['impact'] ?? 'BAJA');
            if (isset($matrix[$key])) $matrix[$key][] = $r;
        }

        return $this->response->setJSON([
            'risks'      => $rows,
            'matrix'     => $matrix,
            'levels'     => $levels,
        ]);
    }

    /** Velocity trend — last N sprints with regression line */
    public function velocityTrend(int $projectId): ResponseInterface
    {
        $db = Database::connect();

        $sprints = $db->query("
            SELECT s.id, s.name, s.number,
                   COALESCE(SUM(t.story_points), 0)    AS planned_points,
                   COALESCE(SUM(CASE WHEN t.status='COMPLETADA' THEN t.story_points ELSE 0 END), 0) AS completed_points,
                   COALESCE(SUM(t.estimated_hours), 0) AS planned_hours,
                   COALESCE(SUM(CASE WHEN t.status='COMPLETADA' THEN t.estimated_hours ELSE 0 END), 0) AS completed_hours,
                   COUNT(t.id) AS total_tasks,
                   SUM(t.status='COMPLETADA') AS done_tasks
            FROM sprints s
            LEFT JOIN tasks t ON t.sprint_id = s.id AND t.parent_task_id IS NULL
            WHERE s.project_id = ?
            GROUP BY s.id
            ORDER BY s.number ASC
        ", [$projectId])->getResultArray();

        // Add trend: simple moving average of last 3 sprints
        $velocities = array_column($sprints, 'completed_points');
        foreach ($sprints as $i => &$sp) {
            $window    = array_slice($velocities, max(0, $i - 2), min(3, $i + 1));
            $sp['avg'] = count($window) ? round(array_sum($window) / count($window), 1) : 0;
        }

        // Overall avg velocity
        $done    = array_filter($sprints, fn($s) => $s['done_tasks'] > 0);
        $avgV    = count($done) ? round(array_sum(array_column($done, 'completed_points')) / count($done), 1) : 0;

        return $this->response->setJSON(['sprints' => $sprints, 'avg_velocity' => $avgV]);
    }

    /** Profitability: budget vs cost of hours */
    public function profitability(int $projectId): ResponseInterface
    {
        $db = Database::connect();

        $project = $db->table('projects')->where('id', $projectId)->get()->getRowArray();
        if (!$project) {
            return $this->response->setStatusCode(404)->setJSON(['message' => 'Proyecto no encontrado']);
        }

        // Time logs per sprint
        $bysprint = $db->query("
            SELECT s.id, s.name, s.number,
                   COALESCE(SUM(tl.hours), 0) AS logged_hours,
                   COALESCE(SUM(t.estimated_hours), 0) AS estimated_hours,
                   s.budget AS sprint_budget
            FROM sprints s
            LEFT JOIN tasks t ON t.sprint_id = s.id
            LEFT JOIN task_time_logs tl ON tl.task_id = t.id
            WHERE s.project_id = ?
            GROUP BY s.id
            ORDER BY s.number
        ", [$projectId])->getResultArray();

        $hourlyRate    = (float)($project['hourly_rate']    ?? 0);
        $plannedBudget = (float)($project['planned_budget'] ?? 0);
        $actualBudget  = (float)($project['actual_budget']  ?? 0);
        $totalLogged   = array_sum(array_column($byprint, 'logged_hours'));
        $computedCost  = round($hourlyRate * $totalLogged, 2);

        return $this->response->setJSON([
            'project'        => ['id' => $projectId, 'name' => $project['name']],
            'planned_budget' => $plannedBudget,
            'actual_budget'  => $actualBudget,
            'hourly_rate'    => $hourlyRate,
            'total_hours'    => $totalLogged,
            'computed_cost'  => $computedCost,
            'margin'         => $plannedBudget > 0 ? round((($plannedBudget - $computedCost) / $plannedBudget) * 100, 1) : null,
            'by_sprint'      => $byprint,
        ]);
    }
}
