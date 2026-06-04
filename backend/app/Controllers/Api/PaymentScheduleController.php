<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Libraries\Auth;
use App\Models\PaymentScheduleModel;
use App\Models\ProjectModel;
use App\Models\MilestoneModel;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Payment schedule per project
 *
 * GET    /api/projects/:id/payments          – list + summary
 * POST   /api/projects/:id/payments          – create
 * PATCH  /api/payments/:id                   – edit
 * PATCH  /api/payments/:id/mark-paid         – mark as paid
 * DELETE /api/payments/:id                   – delete
 */
class PaymentScheduleController extends BaseController
{
    private PaymentScheduleModel $model;
    private ProjectModel         $projects;

    public function __construct()
    {
        $this->model    = new PaymentScheduleModel();
        $this->projects = new ProjectModel();
    }

    public function index(int $projectId): ResponseInterface
    {
        if (!$this->projects->find($projectId)) {
            return $this->response->setStatusCode(404)->setJSON(['message' => 'Proyecto no encontrado']);
        }
        $this->model->markOverdue();

        // Get milestones for dropdown
        $db         = \Config\Database::connect();
        $milestones = $db->table('milestones')
            ->select('id, title, due_date')
            ->where('project_id', $projectId)
            ->orderBy('due_date')
            ->get()->getResultArray();

        return $this->response->setJSON([
            'payments'   => $this->model->forProject($projectId),
            'summary'    => $this->model->summary($projectId),
            'milestones' => $milestones,
        ]);
    }

    public function create(int $projectId): ResponseInterface
    {
        if (!$this->projects->find($projectId)) {
            return $this->response->setStatusCode(404)->setJSON(['message' => 'Proyecto no encontrado']);
        }

        $data    = $this->request->getJSON(true) ?: $this->request->getPost();
        $concept = trim((string)($data['concept']  ?? ''));
        $amount  = (float)($data['amount']    ?? 0);
        $dueDate = trim((string)($data['due_date'] ?? ''));

        if (!$concept || $amount <= 0 || !$dueDate) {
            return $this->response->setStatusCode(422)
                ->setJSON(['message' => 'Concepto, monto y fecha de vencimiento son obligatorios']);
        }

        $id = $this->model->insert([
            'project_id'  => $projectId,
            'concept'     => mb_substr($concept, 0, 255),
            'amount'      => round($amount, 2),
            'due_date'    => date('Y-m-d', strtotime($dueDate)),
            'status'      => 'pendiente',
            'milestone_id'=> !empty($data['milestone_id']) ? (int)$data['milestone_id'] : null,
            'notes'       => mb_substr(trim((string)($data['notes'] ?? '')), 0, 500) ?: null,
            'created_by'  => Auth::id(),
        ]);

        return $this->response->setStatusCode(201)->setJSON($this->model->find($id));
    }

    public function update(int $id): ResponseInterface
    {
        $payment = $this->model->find($id);
        if (!$payment) return $this->response->setStatusCode(404)->setJSON(['message' => 'Pago no encontrado']);

        $data    = $this->request->getJSON(true) ?: $this->request->getPost();
        $allowed = [];

        if (!empty($data['concept']))  $allowed['concept']      = mb_substr(trim((string)$data['concept']), 0, 255);
        if (!empty($data['amount']))   $allowed['amount']       = round((float)$data['amount'], 2);
        if (!empty($data['due_date'])) $allowed['due_date']     = date('Y-m-d', strtotime($data['due_date']));
        if (isset($data['milestone_id'])) $allowed['milestone_id'] = $data['milestone_id'] ? (int)$data['milestone_id'] : null;
        if (array_key_exists('notes', $data)) $allowed['notes'] = mb_substr(trim((string)$data['notes']), 0, 500) ?: null;

        if (empty($allowed)) return $this->response->setStatusCode(422)->setJSON(['message' => 'Nada que actualizar']);

        $this->model->update($id, $allowed);
        return $this->response->setJSON($this->model->find($id));
    }

    public function markPaid(int $id): ResponseInterface
    {
        $payment = $this->model->find($id);
        if (!$payment) return $this->response->setStatusCode(404)->setJSON(['message' => 'Pago no encontrado']);

        $data   = $this->request->getJSON(true) ?: [];
        $paidAt = !empty($data['paid_at']) ? date('Y-m-d', strtotime($data['paid_at'])) : date('Y-m-d');

        $this->model->update($id, ['status' => 'pagado', 'paid_at' => $paidAt]);
        return $this->response->setJSON($this->model->find($id));
    }

    public function delete(int $id): ResponseInterface
    {
        if (!$this->model->find($id)) return $this->response->setStatusCode(404)->setJSON(['message' => 'Pago no encontrado']);
        $this->model->delete($id);
        return $this->response->setStatusCode(204)->setBody('');
    }
}
