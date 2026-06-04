<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Libraries\Auth;
use App\Libraries\ProjectGate;
use App\Models\BudgetItemModel;
use App\Models\ProjectModel;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Project budget line items
 *
 * GET    /api/projects/:id/budget          – items + summary
 * POST   /api/projects/:id/budget          – add item
 * PATCH  /api/budget/:id                   – edit item
 * DELETE /api/budget/:id                   – delete item
 * PUT    /api/projects/:id/budget/totals   – sync planned/actual totals to project
 */
class BudgetController extends BaseController
{
    private BudgetItemModel $model;
    private ProjectModel    $projects;

    public function __construct()
    {
        $this->model    = new BudgetItemModel();
        $this->projects = new ProjectModel();
    }

    public function index(int $projectId): ResponseInterface
    {
        if (!$this->projects->find($projectId)) {
            return $this->response->setStatusCode(404)->setJSON(['message' => 'Proyecto no encontrado']);
        }
        $project = $this->projects->find($projectId);

        return $this->response->setJSON([
            'items'   => $this->model->forProject($projectId),
            'summary' => $this->model->summaryByCategory($projectId),
            'project' => [
                'planned_budget' => $project['planned_budget'] ?? 0,
                'actual_budget'  => $project['actual_budget']  ?? 0,
                'currency'       => $project['currency'] ?? 'MXN',
            ],
        ]);
    }

    public function create(int $projectId): ResponseInterface
    {
        if (!$this->projects->find($projectId)) {
            return $this->response->setStatusCode(404)->setJSON(['message' => 'Proyecto no encontrado']);
        }

        $data = $this->request->getJSON(true) ?: $this->request->getPost();

        $desc = trim((string)($data['description'] ?? ''));
        if (!$desc) {
            return $this->response->setStatusCode(422)->setJSON(['message' => 'Descripción requerida']);
        }

        $cats = ['materiales','mano_obra','equipos','servicios','viajes','otros'];
        $cat  = in_array($data['category'] ?? '', $cats) ? $data['category'] : 'otros';

        $id = $this->model->insert([
            'project_id'     => $projectId,
            'category'       => $cat,
            'description'    => mb_substr($desc, 0, 255),
            'planned_amount' => max(0, (float)($data['planned_amount'] ?? 0)),
            'actual_amount'  => max(0, (float)($data['actual_amount']  ?? 0)),
            'date'           => !empty($data['date']) ? date('Y-m-d', strtotime($data['date'])) : null,
            'notes'          => mb_substr(trim((string)($data['notes'] ?? '')), 0, 500) ?: null,
            'created_by'     => Auth::id(),
        ]);

        $this->syncTotals($projectId);
        return $this->response->setStatusCode(201)->setJSON($this->model->find($id));
    }

    public function update(int $id): ResponseInterface
    {
        $item = $this->model->find($id);
        if (!$item) return $this->response->setStatusCode(404)->setJSON(['message' => 'Partida no encontrada']);

        $data    = $this->request->getJSON(true) ?: $this->request->getPost();
        $allowed = [];
        $cats    = ['materiales','mano_obra','equipos','servicios','viajes','otros'];

        if (!empty($data['description']))   $allowed['description']    = mb_substr(trim((string)$data['description']), 0, 255);
        if (!empty($data['category']) && in_array($data['category'], $cats)) $allowed['category'] = $data['category'];
        if (isset($data['planned_amount'])) $allowed['planned_amount'] = max(0, (float)$data['planned_amount']);
        if (isset($data['actual_amount']))  $allowed['actual_amount']  = max(0, (float)$data['actual_amount']);
        if (isset($data['date']))           $allowed['date']           = $data['date'] ? date('Y-m-d', strtotime($data['date'])) : null;
        if (array_key_exists('notes', $data)) $allowed['notes']       = mb_substr(trim((string)$data['notes']), 0, 500) ?: null;

        if (empty($allowed)) return $this->response->setStatusCode(422)->setJSON(['message' => 'Nada que actualizar']);

        $this->model->update($id, $allowed);
        $this->syncTotals((int)$item['project_id']);
        return $this->response->setJSON($this->model->find($id));
    }

    public function delete(int $id): ResponseInterface
    {
        $item = $this->model->find($id);
        if (!$item) return $this->response->setStatusCode(404)->setJSON(['message' => 'Partida no encontrada']);
        $this->model->delete($id);
        $this->syncTotals((int)$item['project_id']);
        return $this->response->setStatusCode(204)->setBody('');
    }

    /** Recalculate project.planned_budget and project.actual_budget from items */
    private function syncTotals(int $projectId): void
    {
        $db = \Config\Database::connect();
        $row = $db->query(
            "SELECT COALESCE(SUM(planned_amount),0) AS p, COALESCE(SUM(actual_amount),0) AS a FROM budget_items WHERE project_id = ?",
            [$projectId]
        )->getRowArray();

        $this->projects->update($projectId, [
            'planned_budget' => $row['p'] ?? 0,
            'actual_budget'  => $row['a'] ?? 0,
        ]);
    }
}
