<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Libraries\Auth;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

/**
 * Task labels (colored tags).
 *
 * GET    /api/projects/:id/labels
 * POST   /api/projects/:id/labels        { name, color }
 * PATCH  /api/labels/:id
 * DELETE /api/labels/:id
 * POST   /api/tasks/:id/labels           { label_id }  — attach
 * DELETE /api/tasks/:id/labels/:labelId  — detach
 */
class LabelsController extends BaseController
{
    public function index(int $projectId): ResponseInterface
    {
        $db = Database::connect();
        return $this->response->setJSON(
            $db->table('task_labels')->where('project_id', $projectId)->orWhere('project_id IS NULL')->get()->getResultArray()
        );
    }

    public function create(int $projectId): ResponseInterface
    {
        $db   = Database::connect();
        $data = $this->request->getJSON(true);
        if (empty($data['name'])) return $this->response->setStatusCode(422)->setJSON(['message' => 'Nombre requerido']);

        $db->table('task_labels')->insert([
            'project_id' => $projectId,
            'name'       => $data['name'],
            'color'      => $data['color'] ?? '#6366f1',
            'created_by' => Auth::id(),
        ]);
        return $this->response->setStatusCode(201)->setJSON(
            $db->table('task_labels')->where('id', $db->insertID())->get()->getRowArray()
        );
    }

    public function update(int $id): ResponseInterface
    {
        $db   = Database::connect();
        $data = $this->request->getJSON(true);
        $db->table('task_labels')->where('id', $id)->update(array_intersect_key($data, array_flip(['name','color'])));
        return $this->response->setJSON($db->table('task_labels')->where('id', $id)->get()->getRowArray());
    }

    public function delete(int $id): ResponseInterface
    {
        Database::connect()->table('task_labels')->where('id', $id)->delete();
        return $this->response->setStatusCode(204)->setBody('');
    }

    /** GET /api/tasks/:id/labels — labels for a task */
    public function taskLabels(int $taskId): ResponseInterface
    {
        $db = Database::connect();
        return $this->response->setJSON($db->query("
            SELECT l.* FROM task_labels l
            JOIN task_label_pivot p ON p.label_id = l.id
            WHERE p.task_id = ?
        ", [$taskId])->getResultArray());
    }

    /** POST /api/tasks/:id/labels { label_id } */
    public function attach(int $taskId): ResponseInterface
    {
        $db      = Database::connect();
        $labelId = (int)($this->request->getJSON(true)['label_id'] ?? 0);
        if (!$labelId) return $this->response->setStatusCode(422)->setJSON(['message' => 'label_id requerido']);

        $db->table('task_label_pivot')->replace(['task_id' => $taskId, 'label_id' => $labelId]);
        return $this->response->setStatusCode(201)->setJSON(['ok' => true]);
    }

    /** DELETE /api/tasks/:taskId/labels/:labelId */
    public function detach(int $taskId, int $labelId): ResponseInterface
    {
        Database::connect()->table('task_label_pivot')
            ->where('task_id', $taskId)->where('label_id', $labelId)->delete();
        return $this->response->setStatusCode(204)->setBody('');
    }
}
