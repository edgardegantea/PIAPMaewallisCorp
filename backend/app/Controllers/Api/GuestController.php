<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Libraries\Auth;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

/**
 * Read-only guest access via invite token.
 *
 * GET  /api/guest/:token          → project overview (no auth required)
 * POST /api/projects/:id/invites  → create invite link (requires auth)
 * GET  /api/projects/:id/invites  → list invites
 * DELETE /api/invites/:id
 */
class GuestController extends BaseController
{
    /** Public: view project via invite token */
    public function view(string $token): ResponseInterface
    {
        $db     = Database::connect();
        $invite = $db->table('project_invites')
            ->where('token', $token)
            ->where('is_active', 1)
            ->get()->getRowArray();

        if (!$invite) {
            return $this->response->setStatusCode(404)->setJSON(['message' => 'Enlace no válido o expirado']);
        }
        if ($invite['expires_at'] && new \DateTime($invite['expires_at']) < new \DateTime()) {
            return $this->response->setStatusCode(403)->setJSON(['message' => 'Enlace expirado']);
        }

        $projectId = (int)$invite['project_id'];
        $project   = $db->table('projects')->where('id', $projectId)->get()->getRowArray();

        $sprints    = $db->table('sprints')->where('project_id', $projectId)->orderBy('number')->get()->getResultArray();
        $milestones = $db->table('milestones')->where('project_id', $projectId)->orderBy('due_date')->get()->getResultArray();

        $risks = $db->query(
            "SELECT description, probability, impact, status FROM risks WHERE project_id = ? AND status = 'ACTIVO'",
            [$projectId]
        )->getResultArray();

        $taskStats = $db->query("
            SELECT t.status, COUNT(*) AS cnt
            FROM tasks t JOIN sprints s ON s.id = t.sprint_id
            WHERE s.project_id = ? AND t.parent_task_id IS NULL
            GROUP BY t.status
        ", [$projectId])->getResultArray();

        // Budget items summary
        $budgetSummary = $db->query("
            SELECT category,
                   COALESCE(SUM(planned_amount),0) AS planned,
                   COALESCE(SUM(actual_amount),0)  AS actual
            FROM budget_items WHERE project_id = ?
            GROUP BY category ORDER BY category
        ", [$projectId])->getResultArray();

        // Payment schedule (only pending/overdue/paid for client)
        $payments = $db->query("
            SELECT concept, amount, due_date, status, paid_at
            FROM payment_schedules WHERE project_id = ?
            ORDER BY due_date
        ", [$projectId])->getResultArray();

        // Team members (name + role only, no personal data)
        $members = $db->query("
            SELECT CONCAT(u.first_name,' ',u.last_name) AS name,
                   u.position, pm.role AS project_role
            FROM project_members pm
            JOIN users u ON u.id = pm.user_id
            WHERE pm.project_id = ?
            ORDER BY u.first_name
        ", [$projectId])->getResultArray();

        // Public documents (no file path)
        $documents = $db->query("
            SELECT title, type, created_at
            FROM project_documents WHERE project_id = ?
            ORDER BY created_at DESC LIMIT 10
        ", [$projectId])->getResultArray();

        return $this->response->setJSON([
            'project'        => $project,
            'sprints'        => $sprints,
            'milestones'     => $milestones,
            'risks'          => $risks,
            'task_stats'     => $taskStats,
            'budget_summary' => $budgetSummary,
            'payments'       => $payments,
            'members'        => $members,
            'documents'      => $documents,
            'invite'         => ['label' => $invite['label'], 'expires_at' => $invite['expires_at']],
        ]);
    }

    public function createInvite(int $projectId): ResponseInterface
    {
        $db   = Database::connect();
        $data = $this->request->getJSON(true);

        $token = bin2hex(random_bytes(24));
        $db->table('project_invites')->insert([
            'project_id' => $projectId,
            'token'      => $token,
            'label'      => $data['label'] ?? 'Acceso de cliente',
            'expires_at' => $data['expires_at'] ?? null,
            'is_active'  => 1,
            'created_by' => Auth::id(),
            'created_at' => date('Y-m-d H:i:s'),
        ]);

        $baseUrl = env('APP_FRONTEND_URL', 'https://piap.maewalliscorp.org');
        return $this->response->setStatusCode(201)->setJSON([
            'token'     => $token,
            'url'       => "{$baseUrl}/guest/{$token}",
            'expires_at'=> $data['expires_at'] ?? null,
        ]);
    }

    public function listInvites(int $projectId): ResponseInterface
    {
        $rows = Database::connect()->table('project_invites')
            ->where('project_id', $projectId)->orderBy('created_at', 'DESC')->get()->getResultArray();
        $baseUrl = env('APP_FRONTEND_URL', 'https://piap.maewalliscorp.org');
        foreach ($rows as &$r) $r['url'] = "{$baseUrl}/guest/{$r['token']}";
        return $this->response->setJSON($rows);
    }

    public function deleteInvite(int $id): ResponseInterface
    {
        Database::connect()->table('project_invites')->where('id', $id)->delete();
        return $this->response->setStatusCode(204)->setBody('');
    }
}
