<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Libraries\ProjectGate;
use App\Models\TaskModel;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

/**
 * GET    /api/tasks/:taskId/dependencies  — dependencias de una tarea
 * POST   /api/tasks/:taskId/dependencies  — crear dependencia
 * DELETE /api/dependencies/:id            — eliminar dependencia
 */
class TaskDependenciesController extends BaseController
{
    private TaskModel $taskModel;

    public function __construct()
    {
        $this->taskModel = new TaskModel();
    }

    /**
     * Retorna las dependencias de una tarea:
     *   blockers : tareas que bloquean a esta
     *   blocking : tareas que esta tarea bloquea
     */
    public function index(int $taskId): ResponseInterface
    {
        if (!$this->taskModel->find($taskId)) {
            return $this->response->setStatusCode(404)->setJSON(['message' => 'Tarea no encontrada']);
        }

        $db = Database::connect();

        // Tareas que bloquean a $taskId (esta tarea espera por ellas)
        $blockers = $db->query("
            SELECT td.id, td.type, td.blocker_id AS task_id,
                   t.title, t.status, t.priority
            FROM task_dependencies td
            JOIN tasks t ON t.id = td.blocker_id
            WHERE td.task_id = ?
            ORDER BY t.status DESC, t.priority ASC
        ", [$taskId])->getResultArray();

        // Tareas que $taskId bloquea (ellas esperan por esta)
        $blocking = $db->query("
            SELECT td.id, td.type, td.task_id AS task_id,
                   t.title, t.status, t.priority
            FROM task_dependencies td
            JOIN tasks t ON t.id = td.task_id
            WHERE td.blocker_id = ?
            ORDER BY t.status DESC, t.priority ASC
        ", [$taskId])->getResultArray();

        return $this->response->setJSON([
            'blockers' => $blockers,
            'blocking' => $blocking,
        ]);
    }

    /**
     * Crea una dependencia.
     * Body: { blocker_id, type? }  — esta tarea quedará bloqueada por blocker_id
     *   o:  { blocked_id, type? }  — esta tarea bloqueará a blocked_id
     */
    public function create(int $taskId): ResponseInterface
    {
        $task = $this->taskModel->find($taskId);
        if (!$task) {
            return $this->response->setStatusCode(404)->setJSON(['message' => 'Tarea no encontrada']);
        }

        $projectId = ProjectGate::projectIdFromTask($taskId);
        if ($projectId && !ProjectGate::canWrite($projectId)) {
            return ProjectGate::deny($this->response);
        }

        $data = $this->request->getJSON(true) ?? $this->request->getPost();

        // Modo A: "taskId está bloqueada por blocker_id"
        if (!empty($data['blocker_id'])) {
            $blockerId = (int) $data['blocker_id'];
            if ($blockerId === $taskId) {
                return $this->response->setStatusCode(422)->setJSON(['message' => 'Una tarea no puede bloquearse a sí misma']);
            }
            if (!$this->taskModel->find($blockerId)) {
                return $this->response->setStatusCode(404)->setJSON(['message' => 'Tarea bloqueadora no encontrada']);
            }
            $type = in_array($data['type'] ?? '', ['BLOCKS','RELATED']) ? $data['type'] : 'BLOCKS';
            return $this->insertDep($taskId, $blockerId, $type);
        }

        // Modo B: "taskId bloquea a blocked_id"
        if (!empty($data['blocked_id'])) {
            $blockedId = (int) $data['blocked_id'];
            if ($blockedId === $taskId) {
                return $this->response->setStatusCode(422)->setJSON(['message' => 'Una tarea no puede bloquearse a sí misma']);
            }
            if (!$this->taskModel->find($blockedId)) {
                return $this->response->setStatusCode(404)->setJSON(['message' => 'Tarea bloqueada no encontrada']);
            }
            $type = in_array($data['type'] ?? '', ['BLOCKS','RELATED']) ? $data['type'] : 'BLOCKS';
            return $this->insertDep($blockedId, $taskId, $type);
        }

        return $this->response->setStatusCode(422)->setJSON(['message' => 'Se requiere blocker_id o blocked_id']);
    }

    private function insertDep(int $taskId, int $blockerId, string $type): ResponseInterface
    {
        $db = Database::connect();

        // Check circular: si taskId ya bloquea a blockerId (directamente)
        $circular = $db->table('task_dependencies')
            ->where('task_id', $blockerId)
            ->where('blocker_id', $taskId)
            ->countAllResults();
        if ($circular) {
            return $this->response->setStatusCode(422)->setJSON(['message' => 'Dependencia circular detectada']);
        }

        // Check duplicate
        $exists = $db->table('task_dependencies')
            ->where('task_id', $taskId)
            ->where('blocker_id', $blockerId)
            ->countAllResults();
        if ($exists) {
            return $this->response->setStatusCode(422)->setJSON(['message' => 'La dependencia ya existe']);
        }

        $db->table('task_dependencies')->insert([
            'task_id'    => $taskId,
            'blocker_id' => $blockerId,
            'type'       => $type,
            'created_at' => date('Y-m-d H:i:s'),
        ]);

        $id  = $db->insertID();
        $row = $db->table('task_dependencies td')
            ->select('td.*, t.title, t.status, t.priority')
            ->join('tasks t', "t.id = td.blocker_id")
            ->where('td.id', $id)
            ->get()->getRowArray();

        return $this->response->setStatusCode(201)->setJSON($row);
    }

    /**
     * GET /api/projects/:projectId/dependencies
     * Returns all tasks + all dependency edges for the project — used by the dependency graph view.
     */
    public function byProject(int $projectId): ResponseInterface
    {
        $db = Database::connect();

        $tasks = $db->query("
            SELECT t.id, t.title, t.status, t.priority, s.name AS sprint_name
            FROM tasks t
            JOIN sprints s ON s.id = t.sprint_id
            WHERE s.project_id = ? AND t.parent_task_id IS NULL
            ORDER BY t.status, t.title
            LIMIT 200
        ", [$projectId])->getResultArray();

        $edges = $db->query("
            SELECT td.id, td.task_id, td.blocker_id, td.type
            FROM task_dependencies td
            JOIN tasks t ON t.id = td.task_id
            JOIN sprints s ON s.id = t.sprint_id
            WHERE s.project_id = ?
        ", [$projectId])->getResultArray();

        return $this->response->setJSON([
            'tasks' => $tasks,
            'edges' => $edges,
        ]);
    }

    public function delete(int $id): ResponseInterface
    {
        $db  = Database::connect();
        $dep = $db->table('task_dependencies')->where('id', $id)->get()->getRowArray();

        if (!$dep) {
            return $this->response->setStatusCode(404)->setJSON(['message' => 'Dependencia no encontrada']);
        }

        $projectId = ProjectGate::projectIdFromTask((int) $dep['task_id']);
        if ($projectId && !ProjectGate::canWrite($projectId)) {
            return ProjectGate::deny($this->response);
        }

        $db->table('task_dependencies')->where('id', $id)->delete();
        return $this->response->setStatusCode(204)->setBody('');
    }
}
