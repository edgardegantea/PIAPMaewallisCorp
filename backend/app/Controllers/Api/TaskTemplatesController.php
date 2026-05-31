<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Libraries\Auth;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

/**
 * Task templates — create a task from a pre-defined template.
 *
 * GET    /api/projects/:id/task-templates
 * POST   /api/projects/:id/task-templates    { name, title, description, priority, estimated_hours, story_points, checklist[] }
 * PATCH  /api/task-templates/:id
 * DELETE /api/task-templates/:id
 * POST   /api/task-templates/:id/apply       { sprint_id, assigned_to? }
 */
class TaskTemplatesController extends BaseController
{
    public function index(int $projectId): ResponseInterface
    {
        $db = Database::connect();
        return $this->response->setJSON(
            $db->table('task_templates')
                ->where('project_id', $projectId)->orWhere('project_id IS NULL')
                ->orderBy('name')->get()->getResultArray()
        );
    }

    public function create(int $projectId): ResponseInterface
    {
        $db   = Database::connect();
        $data = $this->request->getJSON(true);
        if (empty($data['name'])) return $this->response->setStatusCode(422)->setJSON(['message' => 'Nombre requerido']);

        $db->table('task_templates')->insert([
            'project_id'      => $projectId,
            'name'            => $data['name'],
            'title'           => $data['title']           ?? $data['name'],
            'description'     => $data['description']     ?? null,
            'priority'        => $data['priority']        ?? 'MEDIA',
            'estimated_hours' => (int)($data['estimated_hours'] ?? 0),
            'story_points'    => isset($data['story_points']) ? (int)$data['story_points'] : null,
            'checklist'       => isset($data['checklist']) ? json_encode($data['checklist']) : null,
            'created_by'      => Auth::id(),
            'created_at'      => date('Y-m-d H:i:s'),
        ]);
        $id  = $db->insertID();
        $row = $db->table('task_templates')->where('id', $id)->get()->getRowArray();
        if ($row['checklist']) $row['checklist'] = json_decode($row['checklist'], true);
        return $this->response->setStatusCode(201)->setJSON($row);
    }

    public function update(int $id): ResponseInterface
    {
        $db   = Database::connect();
        $data = $this->request->getJSON(true);
        $allowed = ['name','title','description','priority','estimated_hours','story_points','checklist'];
        $payload = array_intersect_key($data, array_flip($allowed));
        if (isset($payload['checklist'])) $payload['checklist'] = json_encode($payload['checklist']);
        $db->table('task_templates')->where('id', $id)->update($payload);
        return $this->response->setJSON($db->table('task_templates')->where('id', $id)->get()->getRowArray());
    }

    public function delete(int $id): ResponseInterface
    {
        Database::connect()->table('task_templates')->where('id', $id)->delete();
        return $this->response->setStatusCode(204)->setBody('');
    }

    /** Instantiate template as a real task */
    public function apply(int $templateId): ResponseInterface
    {
        $db       = Database::connect();
        $tpl      = $db->table('task_templates')->where('id', $templateId)->get()->getRowArray();
        if (!$tpl) return $this->response->setStatusCode(404)->setJSON(['message' => 'Plantilla no encontrada']);

        $data     = $this->request->getJSON(true);
        $sprintId = (int)($data['sprint_id'] ?? 0);
        if (!$sprintId) return $this->response->setStatusCode(422)->setJSON(['message' => 'sprint_id requerido']);

        $db->table('tasks')->insert([
            'sprint_id'       => $sprintId,
            'title'           => $tpl['title'],
            'description'     => $tpl['description'],
            'priority'        => $tpl['priority'],
            'estimated_hours' => $tpl['estimated_hours'],
            'story_points'    => $tpl['story_points'],
            'status'          => 'PENDIENTE',
            'assigned_to'     => $data['assigned_to'] ?? null,
            'created_at'      => date('Y-m-d H:i:s'),
            'updated_at'      => date('Y-m-d H:i:s'),
        ]);
        $taskId = $db->insertID();

        // Create checklist items
        if ($tpl['checklist']) {
            $items = json_decode($tpl['checklist'], true) ?? [];
            foreach ($items as $i => $item) {
                $db->table('task_checklists')->insert([
                    'task_id'    => $taskId,
                    'text'       => is_string($item) ? $item : ($item['text'] ?? ''),
                    'is_done'    => 0,
                    'sort_order' => $i,
                    'created_at' => date('Y-m-d H:i:s'),
                ]);
            }
        }

        return $this->response->setStatusCode(201)->setJSON([
            'task_id' => $taskId,
            'message' => 'Tarea creada desde plantilla',
        ]);
    }
}
