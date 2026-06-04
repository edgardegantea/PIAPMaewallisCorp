<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Libraries\Auth;
use App\Models\LeaveRequestModel;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Leave / permission requests
 *
 * USER:
 *   GET    /api/leave-requests/my
 *   POST   /api/leave-requests
 *   DELETE /api/leave-requests/:id        (only own pending)
 *
 * ADMIN:
 *   GET    /api/admin/leave-requests
 *   PATCH  /api/admin/leave-requests/:id/approve
 *   PATCH  /api/admin/leave-requests/:id/reject
 */
class LeaveRequestsController extends BaseController
{
    private LeaveRequestModel $model;

    public function __construct()
    {
        $this->model = new LeaveRequestModel();
    }

    // ── User ─────────────────────────────────────────────────────────────────

    public function my(): ResponseInterface
    {
        $limit  = min(100, (int)($this->request->getGet('limit')  ?? 30));
        $offset = max(0,   (int)($this->request->getGet('offset') ?? 0));
        return $this->response->setJSON($this->model->forUser(Auth::id(), $limit, $offset));
    }

    public function create(): ResponseInterface
    {
        $data = $this->request->getJSON(true) ?: $this->request->getPost();

        $type      = trim((string)($data['type']       ?? 'permiso'));
        $startDate = trim((string)($data['start_date'] ?? ''));
        $endDate   = trim((string)($data['end_date']   ?? $startDate));
        $reason    = mb_substr(trim((string)($data['reason'] ?? '')), 0, 1000) ?: null;

        if (!$startDate || strtotime($startDate) === false) {
            return $this->response->setStatusCode(422)->setJSON(['message' => 'Fecha de inicio requerida']);
        }
        if (!in_array($type, ['vacaciones','enfermedad','permiso','otro'])) {
            $type = 'permiso';
        }

        $start = new \DateTime($startDate);
        $end   = new \DateTime($endDate);
        if ($end < $start) $end = clone $start;

        // Count business days (Mon–Fri) between dates
        $days = 0;
        $cur  = clone $start;
        while ($cur <= $end) {
            if ((int)$cur->format('N') <= 5) $days++;
            $cur->modify('+1 day');
        }
        $days = max(1, $days);

        $id = $this->model->insert([
            'user_id'    => Auth::id(),
            'type'       => $type,
            'start_date' => $start->format('Y-m-d'),
            'end_date'   => $end->format('Y-m-d'),
            'days_count' => $days,
            'reason'     => $reason,
            'status'     => 'pendiente',
        ]);

        return $this->response->setStatusCode(201)->setJSON($this->model->find($id));
    }

    public function cancel(int $id): ResponseInterface
    {
        $req = $this->model->find($id);
        if (!$req) return $this->response->setStatusCode(404)->setJSON(['message' => 'Solicitud no encontrada']);
        if ((int)$req['user_id'] !== Auth::id()) return $this->response->setStatusCode(403)->setJSON(['message' => 'No autorizado']);
        if ($req['status'] !== 'pendiente') return $this->response->setStatusCode(422)->setJSON(['message' => 'Solo se pueden cancelar solicitudes pendientes']);

        $this->model->update($id, ['status' => 'cancelado']);
        return $this->response->setStatusCode(204)->setBody('');
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    public function all(): ResponseInterface
    {
        $filters = [
            'user_id'   => $this->request->getGet('user_id'),
            'status'    => $this->request->getGet('status') ?? '',
            'type'      => $this->request->getGet('type')   ?? '',
            'date_from' => $this->request->getGet('date_from'),
            'date_to'   => $this->request->getGet('date_to'),
        ];
        $limit  = min(200, (int)($this->request->getGet('limit')  ?? 50));
        $offset = max(0,   (int)($this->request->getGet('offset') ?? 0));
        return $this->response->setJSON($this->model->allWithUsers($filters, $limit, $offset));
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
        $this->model->update($id, [
            'status'       => $status,
            'reviewed_by'  => Auth::id(),
            'reviewed_at'  => date('Y-m-d H:i:s'),
            'review_notes' => mb_substr(trim((string)($data['notes'] ?? '')), 0, 500) ?: null,
        ]);
        return $this->response->setJSON($this->model->find($id));
    }
}
