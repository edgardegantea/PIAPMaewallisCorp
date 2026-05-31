<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

/**
 * Invoice / billing data for a project.
 *
 * GET /api/projects/:id/invoice?from=&to=
 *
 * Returns structured data for the frontend to render as PDF.
 */
class InvoiceController extends BaseController
{
    public function show(int $projectId): ResponseInterface
    {
        $db      = Database::connect();
        $from    = $this->request->getGet('from') ?: date('Y-m-01');
        $to      = $this->request->getGet('to')   ?: date('Y-m-d');

        $project = $db->table('projects p')
            ->select('p.*, CONCAT(u.first_name," ",u.last_name) AS director_name, c.name AS category_name')
            ->join('users u', 'u.id = p.director_id', 'left')
            ->join('project_categories c', 'c.id = p.category_id', 'left')
            ->where('p.id', $projectId)
            ->get()->getRowArray();

        if (!$project) {
            return $this->response->setStatusCode(404)->setJSON(['message' => 'Proyecto no encontrado']);
        }

        // Time logs with user and task info
        $logs = $db->query("
            SELECT
                tl.work_date, tl.hours, tl.description AS log_note,
                t.title AS task_title,
                CONCAT(u.first_name,' ',u.last_name) AS user_name, u.username,
                s.name AS sprint_name
            FROM task_time_logs tl
            JOIN tasks   t ON t.id = tl.task_id
            JOIN sprints s ON s.id = t.sprint_id
            JOIN users   u ON u.id = tl.user_id
            WHERE s.project_id = ? AND tl.work_date BETWEEN ? AND ?
            ORDER BY tl.work_date ASC, u.first_name
        ", [$projectId, $from, $to])->getResultArray();

        // Summary by user
        $byUser = [];
        foreach ($logs as $l) {
            $k = $l['user_name'];
            if (!isset($byUser[$k])) $byUser[$k] = ['user' => $k, 'hours' => 0];
            $byUser[$k]['hours'] += (float)$l['hours'];
        }

        $totalHours   = array_sum(array_column($logs, 'hours'));
        $hourlyRate   = (float)($project['hourly_rate'] ?? 0);
        $totalAmount  = $hourlyRate > 0 ? round($hourlyRate * $totalHours, 2) : null;

        // Company settings
        $company = $db->table('company_settings')->get()->getRowArray() ?? [];

        return $this->response->setJSON([
            'project'      => $project,
            'company'      => $company,
            'period'       => ['from' => $from, 'to' => $to],
            'logs'         => $logs,
            'by_user'      => array_values($byUser),
            'total_hours'  => $totalHours,
            'hourly_rate'  => $hourlyRate,
            'total_amount' => $totalAmount,
            'generated_at' => date('Y-m-d H:i:s'),
        ]);
    }
}
