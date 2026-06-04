<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Libraries\Auth;
use App\Models\AccessRequestModel;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Access request system — Director/PM solicita acceso elevado.
 *
 * USUARIO:
 *   GET    /api/access-requests/my               – propias solicitudes
 *   POST   /api/access-requests                   – nueva solicitud
 *   DELETE /api/access-requests/:id               – cancelar propia pendiente
 *   GET    /api/access-requests/check            – verificar si tiene permiso activo
 *
 * ADMIN (filter: manager):
 *   GET    /api/admin/access-requests             – todas (con filtros)
 *   GET    /api/admin/access-requests/pending     – solo pendientes (para badge)
 *   PATCH  /api/admin/access-requests/:id/approve
 *   PATCH  /api/admin/access-requests/:id/reject
 */
class AccessRequestsController extends BaseController
{
    private AccessRequestModel $model;

    public function __construct()
    {
        $this->model = new AccessRequestModel();
    }

    // ── Usuario ───────────────────────────────────────────────────────────────

    public function my(): ResponseInterface
    {
        return $this->response->setJSON($this->model->forUser(Auth::id()));
    }

    public function create(): ResponseInterface
    {
        $data = $this->request->getJSON(true) ?: $this->request->getPost();

        $types   = ['proyecto','categoria','plantilla','usuario','configuracion','presupuesto','reporte','otro'];
        $actions = ['crear','editar','eliminar','aprobar','ver'];

        $resourceType = in_array($data['resource_type'] ?? '', $types)   ? $data['resource_type'] : 'otro';
        $action       = in_array($data['action']        ?? '', $actions) ? $data['action']        : 'crear';
        $reason       = trim((string)($data['reason']   ?? ''));

        if (!$reason) {
            return $this->response->setStatusCode(422)->setJSON(['message' => 'Debes proporcionar un motivo']);
        }

        // Check if there's already a pending request for the same action
        $existing = $this->model
            ->where('user_id', Auth::id())
            ->where('resource_type', $resourceType)
            ->where('action', $action)
            ->where('status', 'pendiente')
            ->first();

        if ($existing) {
            return $this->response->setStatusCode(409)
                ->setJSON(['message' => 'Ya tienes una solicitud pendiente para esta acción', 'existing' => $existing]);
        }

        $id = $this->model->insert([
            'user_id'       => Auth::id(),
            'resource_type' => $resourceType,
            'resource_id'   => !empty($data['resource_id']) ? (int)$data['resource_id'] : null,
            'resource_name' => mb_substr(trim((string)($data['resource_name'] ?? '')), 0, 255) ?: null,
            'action'        => $action,
            'reason'        => mb_substr($reason, 0, 2000),
            'status'        => 'pendiente',
        ]);

        // Notify admins
        $this->notifyAdmins(Auth::id(), $resourceType, $action);

        return $this->response->setStatusCode(201)->setJSON($this->model->find($id));
    }

    public function cancel(int $id): ResponseInterface
    {
        $req = $this->model->find($id);
        if (!$req) return $this->response->setStatusCode(404)->setJSON(['message' => 'Solicitud no encontrada']);
        if ((int)$req['user_id'] !== Auth::id()) return $this->response->setStatusCode(403)->setJSON(['message' => 'No autorizado']);
        if ($req['status'] !== 'pendiente') return $this->response->setStatusCode(422)->setJSON(['message' => 'Solo se pueden cancelar solicitudes pendientes']);

        $this->model->delete($id);
        return $this->response->setStatusCode(204)->setBody('');
    }

    /** GET /api/access-requests/check?resource_type=X&action=Y&resource_id=Z */
    public function check(): ResponseInterface
    {
        $resourceType = $this->request->getGet('resource_type') ?? '';
        $action       = $this->request->getGet('action')        ?? '';
        $resourceId   = $this->request->getGet('resource_id')   ? (int)$this->request->getGet('resource_id') : null;

        $granted = $this->model->hasActiveGrant(Auth::id(), $resourceType, $action, $resourceId);

        return $this->response->setJSON(['granted' => $granted]);
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    public function all(): ResponseInterface
    {
        $filters = [
            'status'  => $this->request->getGet('status')  ?? '',
            'user_id' => $this->request->getGet('user_id') ?? '',
        ];
        return $this->response->setJSON($this->model->allWithUsers($filters));
    }

    public function pending(): ResponseInterface
    {
        $all = $this->model->allPending(100);
        return $this->response->setJSON(['requests' => $all, 'count' => count($all)]);
    }

    public function approve(int $id): ResponseInterface
    {
        return $this->review($id, 'aprobado');
    }

    public function reject(int $id): ResponseInterface
    {
        return $this->review($id, 'rechazado');
    }

    private function review(int $id, string $status): ResponseInterface
    {
        $req = $this->model->find($id);
        if (!$req) return $this->response->setStatusCode(404)->setJSON(['message' => 'Solicitud no encontrada']);
        if ($req['status'] !== 'pendiente') return $this->response->setStatusCode(422)->setJSON(['message' => 'Solo se pueden revisar solicitudes pendientes']);

        $data = $this->request->getJSON(true) ?: [];

        // Set expiry for approved grants (default 7 days)
        $expiresAt = null;
        if ($status === 'aprobado') {
            $days      = max(1, (int)($data['expires_days'] ?? 7));
            $expiresAt = date('Y-m-d H:i:s', strtotime("+{$days} days"));
        }

        $this->model->update($id, [
            'status'       => $status,
            'reviewed_by'  => Auth::id(),
            'reviewed_at'  => date('Y-m-d H:i:s'),
            'review_notes' => mb_substr(trim((string)($data['notes'] ?? '')), 0, 1000) ?: null,
            'expires_at'   => $expiresAt,
        ]);

        // Notify the requesting user
        $this->notifyUser($req['user_id'], $status, $req, $data['notes'] ?? '');

        return $this->response->setJSON($this->model->find($id));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function notifyAdmins(int $requesterId, string $resourceType, string $action): void
    {
        $db   = \Config\Database::connect();
        $user = $db->table('users')->where('id', $requesterId)->get()->getRowArray();
        $name = trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? '')) ?: ($user['username'] ?? 'Usuario');

        $TYPES   = ['proyecto'=>'proyecto','categoria'=>'categoría','plantilla'=>'plantilla','usuario'=>'usuario','configuracion'=>'configuración','presupuesto'=>'presupuesto','reporte'=>'reporte','otro'=>'elemento'];
        $ACTIONS = ['crear'=>'crear','editar'=>'editar','eliminar'=>'eliminar','aprobar'=>'aprobar','ver'=>'ver'];

        $admins = $db->table('users')->where('role', 'ADMIN')->where('is_active', 1)->get()->getResultArray();
        foreach ($admins as $admin) {
            try {
                $db->table('user_notifications')->insert([
                    'user_id'    => $admin['id'],
                    'title'      => '📋 Nueva solicitud de acceso',
                    'body'       => "{$name} solicita permiso para {$ACTIONS[$action]} {$TYPES[$resourceType]}",
                    'type'       => 'access_request',
                    'is_read'    => 0,
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s'),
                ]);
            } catch (\Throwable) {}
        }
    }

    private function notifyUser(int $userId, string $status, array $req, string $notes): void
    {
        $db = \Config\Database::connect();
        $TYPES = ['proyecto'=>'proyecto','categoria'=>'categoría','plantilla'=>'plantilla','usuario'=>'usuario','configuracion'=>'configuración','presupuesto'=>'presupuesto','reporte'=>'reporte','otro'=>'elemento'];
        $type  = $TYPES[$req['resource_type']] ?? 'elemento';

        $title = $status === 'aprobado' ? '✅ Solicitud aprobada' : '❌ Solicitud rechazada';
        $body  = $status === 'aprobado'
            ? "Tu solicitud para {$req['action']} {$type}" . ($req['resource_name'] ? " ({$req['resource_name']})" : '') . " fue aprobada."
            : "Tu solicitud para {$req['action']} {$type} fue rechazada." . ($notes ? " Motivo: {$notes}" : '');

        try {
            $db->table('user_notifications')->insert([
                'user_id'    => $userId,
                'title'      => $title,
                'body'       => $body,
                'type'       => 'access_request_result',
                'is_read'    => 0,
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
        } catch (\Throwable) {}
    }
}
