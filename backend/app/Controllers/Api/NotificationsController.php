<?php
namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Libraries\Auth;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

/**
 * NotificationsController
 *
 * GET  /notifications          — alertas del sistema + notificaciones de usuario
 * GET  /notifications/user     — solo notificaciones de usuario (paginadas)
 * POST /notifications/:id/read — marcar una como leída
 * POST /notifications/read-all — marcar todas como leídas
 * DELETE /notifications/:id    — eliminar una notificación
 */
class NotificationsController extends BaseController
{
    /**
     * GET /notifications — Devuelve alertas del sistema + resumen de notificaciones de usuario.
     * Mantiene retrocompatibilidad con el frontend existente.
     */
    public function index(): ResponseInterface
    {
        $db     = Database::connect();
        $userId = Auth::id();
        $today  = date('Y-m-d');
        $alerts = [];

        // 1. Proyectos vencidos
        $overdueProjects = $db->query("
            SELECT p.id, p.code, p.name, p.planned_end_date
            FROM projects p
            LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
            WHERE p.is_active = 1
              AND p.planned_end_date < ?
              AND p.status NOT IN ('CIERRE','CANCELADO')
              AND (p.director_id = ? OR pm.user_id = ?)
            GROUP BY p.id LIMIT 10
        ", [$userId, $today, $userId, $userId])->getResultArray();

        foreach ($overdueProjects as $p) {
            $alerts[] = ['type'=>'project_overdue','severity'=>'error',
                'title'=>"Proyecto vencido: {$p['code']}",
                'body'=>"{$p['name']} debía finalizar el {$p['planned_end_date']}",
                'link'=>"/projects/{$p['id']}"];
        }

        // 2. Tareas vencidas asignadas a mí
        $overdueTasks = $db->query("
            SELECT t.id, t.title, t.due_date, s.project_id, p.name as project_name
            FROM tasks t
            JOIN sprints s ON s.id = t.sprint_id
            JOIN projects p ON p.id = s.project_id
            WHERE EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?)
              AND t.due_date < ?
              AND t.status != 'COMPLETADA'
            LIMIT 10
        ", [$userId, $today])->getResultArray();

        foreach ($overdueTasks as $t) {
            $alerts[] = ['type'=>'task_overdue','severity'=>'warning',
                'title'=>"Tarea vencida",
                'body'=>"{$t['title']} — vencida el {$t['due_date']} ({$t['project_name']})",
                'link'=>"/projects/{$t['project_id']}?tab=kanban"];
        }

        // 3. Hitos vencidos
        $overdueMilestones = $db->query("
            SELECT m.id, m.title, m.due_date, m.project_id, p.name as project_name
            FROM milestones m
            JOIN projects p ON p.id = m.project_id
            LEFT JOIN project_members pm ON pm.project_id = m.project_id AND pm.user_id = ?
            WHERE m.due_date < ? AND m.is_completed = 0
              AND (p.director_id = ? OR pm.user_id = ?)
            GROUP BY m.id LIMIT 10
        ", [$userId, $today, $userId, $userId])->getResultArray();

        foreach ($overdueMilestones as $m) {
            $alerts[] = ['type'=>'milestone_overdue','severity'=>'warning',
                'title'=>"Hito vencido",
                'body'=>"{$m['title']} — vencido el {$m['due_date']} ({$m['project_name']})",
                'link'=>"/projects/{$m['project_id']}?tab=milestones"];
        }

        // 4. Riesgos críticos
        $criticalRisks = $db->query("
            SELECT r.id, r.description, r.project_id, p.name as project_name
            FROM risks r
            JOIN projects p ON p.id = r.project_id
            LEFT JOIN project_members pm ON pm.project_id = r.project_id AND pm.user_id = ?
            WHERE r.probability='ALTA' AND r.impact='ALTO' AND r.status='ACTIVO'
              AND p.is_active = 1 AND (p.director_id = ? OR pm.user_id = ?)
            GROUP BY r.id LIMIT 5
        ", [$userId, $userId, $userId])->getResultArray();

        foreach ($criticalRisks as $r) {
            $alerts[] = ['type'=>'risk_critical','severity'=>'error',
                'title'=>"Riesgo crítico sin mitigar",
                'body'=>substr($r['description'],0,80).'... ('.$r['project_name'].')',
                'link'=>"/projects/{$r['project_id']}?tab=risks"];
        }

        // 5. Incidencias críticas
        $criticalIncidents = $db->query("
            SELECT i.id, i.title, i.project_id, p.name as project_name
            FROM incidents i
            JOIN projects p ON p.id = i.project_id
            LEFT JOIN project_members pm ON pm.project_id = i.project_id AND pm.user_id = ?
            WHERE i.severity='CRITICA' AND i.status='ABIERTA'
              AND (p.director_id = ? OR pm.user_id = ?)
            GROUP BY i.id LIMIT 5
        ", [$userId, $userId, $userId])->getResultArray();

        foreach ($criticalIncidents as $i) {
            $alerts[] = ['type'=>'incident_critical','severity'=>'error',
                'title'=>"Incidencia crítica abierta",
                'body'=>"{$i['title']} ({$i['project_name']})",
                'link'=>"/projects/{$i['project_id']}?tab=incidents"];
        }

        // Contar notificaciones de usuario no leídas
        $unreadCount = $db->table('user_notifications')
            ->where('user_id', $userId)->where('is_read', 0)->countAllResults();

        return $this->response->setJSON([
            'count'        => count($alerts),
            'alerts'       => $alerts,
            'unread_user'  => (int) $unreadCount,
        ]);
    }

    /**
     * GET /notifications/user — Notificaciones de usuario paginadas
     */
    public function userNotifications(): ResponseInterface
    {
        $db     = Database::connect();
        $userId = Auth::id();
        $page   = (int) ($this->request->getGet('page') ?? 1);
        $limit  = 20;
        $offset = ($page - 1) * $limit;

        $rows = $db->table('user_notifications')
            ->where('user_id', $userId)
            ->orderBy('created_at', 'DESC')
            ->limit($limit, $offset)
            ->get()->getResultArray();

        $total   = $db->table('user_notifications')->where('user_id', $userId)->countAllResults();
        $unread  = $db->table('user_notifications')->where('user_id', $userId)->where('is_read', 0)->countAllResults();

        return $this->response->setJSON([
            'data'    => $rows,
            'total'   => (int) $total,
            'unread'  => (int) $unread,
            'page'    => $page,
            'pages'   => (int) ceil($total / $limit),
        ]);
    }

    /**
     * POST /notifications/:id/read
     */
    public function markRead(int $id): ResponseInterface
    {
        Database::connect()->table('user_notifications')
            ->where('id', $id)
            ->where('user_id', Auth::id())
            ->update(['is_read' => 1]);
        return $this->response->setJSON(['ok' => true]);
    }

    /**
     * POST /notifications/read-all
     */
    public function markAllRead(): ResponseInterface
    {
        Database::connect()->table('user_notifications')
            ->where('user_id', Auth::id())
            ->where('is_read', 0)
            ->update(['is_read' => 1]);
        return $this->response->setJSON(['ok' => true]);
    }

    /**
     * DELETE /notifications/:id
     */
    public function delete(int $id): ResponseInterface
    {
        Database::connect()->table('user_notifications')
            ->where('id', $id)
            ->where('user_id', Auth::id())
            ->delete();
        return $this->response->setStatusCode(204)->setBody('');
    }

    /**
     * GET /notifications/stream
     *
     * Server-Sent Events stream. Sends a heartbeat every 20 s and a
     * "notifications" event whenever the user has new unread notifications
     * or new system alerts compared to the last check.
     *
     * Clients reconnect automatically via the EventSource API.
     * Max lifetime: 90 s (then close — client reconnects).
     */
    public function stream(): void
    {
        $userId = Auth::id();
        if (!$userId) {
            http_response_code(401);
            echo "data: {\"error\":\"Unauthorized\"}\n\n";
            return;
        }

        // Disable output buffering
        if (ob_get_level()) ob_end_clean();
        @ini_set('output_buffering', 'off');
        @ini_set('zlib.output_compression', false);

        // CORS — stream() uses raw headers so CorsFilter never runs here
        $origin  = $_SERVER['HTTP_ORIGIN'] ?? '';
        $allowed = ['https://piap.maewalliscorp.org', 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'];
        header('Access-Control-Allow-Origin: ' . (in_array($origin, $allowed, true) ? $origin : $allowed[0]));
        header('Access-Control-Allow-Credentials: true');

        header('Content-Type: text/event-stream');
        header('Cache-Control: no-cache');
        header('X-Accel-Buffering: no'); // nginx: disable proxy buffering

        $db       = Database::connect();
        $lastUnread = null;
        $lastAlertHash = null;
        $start    = time();
        $maxAge   = 90; // seconds

        while (!connection_aborted() && (time() - $start) < $maxAge) {
            // ── User notifications ────────────────────────────────────────
            $unread = (int) $db->table('user_notifications')
                ->where('user_id', $userId)
                ->where('is_read', 0)
                ->countAllResults();

            // ── System alerts ─────────────────────────────────────────────
            $today  = date('Y-m-d');
            $alerts = [];

            $overdue = $db->query("
                SELECT COUNT(*) AS c FROM projects p
                WHERE p.is_active = 1 AND p.planned_end_date < ? AND p.status NOT IN ('CERRADO','COMPLETADO')
            ", [$today])->getRowArray();
            if (($overdue['c'] ?? 0) > 0) $alerts[] = 'proj_overdue';

            $blocked = $db->query("
                SELECT COUNT(*) AS c FROM tasks t JOIN sprints s ON s.id = t.sprint_id
                JOIN projects p ON p.id = s.project_id
                WHERE t.status = 'BLOQUEADA' AND p.is_active = 1
            ")->getRowArray();
            if (($blocked['c'] ?? 0) > 0) $alerts[] = 'tasks_blocked';

            $alertHash = md5(implode(',', $alerts));

            // Only push when something changed
            if ($unread !== $lastUnread || $alertHash !== $lastAlertHash) {
                $payload = json_encode([
                    'unread_user' => $unread,
                    'alert_count' => count($alerts),
                    'ts'          => time(),
                ]);
                echo "event: notifications\n";
                echo "data: {$payload}\n\n";
                $lastUnread    = $unread;
                $lastAlertHash = $alertHash;
            } else {
                // Heartbeat
                echo ": heartbeat\n\n";
            }

            flush();
            sleep(20);
        }

        // Tell the client to reconnect after 5 s
        echo "retry: 5000\n\n";
        flush();
    }
}
