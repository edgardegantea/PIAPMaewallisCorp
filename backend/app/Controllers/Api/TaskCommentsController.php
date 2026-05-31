<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Libraries\Auth;
use App\Libraries\EmailService;
use App\Libraries\NotificationService;
use App\Models\TaskCommentModel;
use App\Models\TaskModel;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

class TaskCommentsController extends BaseController
{
    private TaskCommentModel $model;

    public function __construct()
    {
        $this->model = new TaskCommentModel();
    }

    /**
     * GET /api/tasks/{taskId}/comments
     */
    public function index(int $taskId): ResponseInterface
    {
        $taskModel = new TaskModel();
        if (!$taskModel->find($taskId)) {
            return $this->response->setStatusCode(404)->setJSON(['message' => 'Tarea no encontrada']);
        }
        return $this->response->setJSON($this->model->findByTask($taskId));
    }

    /**
     * POST /api/tasks/{taskId}/comments
     */
    public function create(int $taskId): ResponseInterface
    {
        $taskModel = new TaskModel();
        if (!$taskModel->find($taskId)) {
            return $this->response->setStatusCode(404)->setJSON(['message' => 'Tarea no encontrada']);
        }

        $data = $this->request->getJSON(true) ?? $this->request->getPost();
        $rules = ['body' => 'required'];

        if (!$this->validate($rules)) {
            return $this->response->setStatusCode(422)->setJSON(['errors' => $this->validator->getErrors()]);
        }

        $id = $this->model->insert([
            'task_id' => $taskId,
            'user_id' => Auth::id(),
            'body'    => $data['body'],
        ]);

        $comment = $this->model->findByTask($taskId);
        $inserted = array_values(array_filter($comment, fn($c) => (int)$c['id'] === (int)$id))[0] ?? $this->model->find($id);

        // ── Notificaciones de comentario ─────────────────────────────────────
        $commentBody = $data['body'] ?? '';
        $task        = (new TaskModel())->find($taskId);
        $db          = Database::connect();
        $sprint      = $task ? $db->table('sprints')->select('project_id')->where('id', $task['sprint_id'])->get()->getRowArray() : null;
        $projectId   = $sprint['project_id'] ?? null;
        $frontUrl    = env('APP_FRONTEND_URL', 'https://piap.maewalliscorp.org');
        $taskUrl     = $projectId ? "/projects/{$projectId}?tab=kanban" : '';
        $actor       = Auth::user();
        $byName      = trim(($actor['first_name'] ?? '') . ' ' . ($actor['last_name'] ?? ''));

        // 1. Notificar @menciones (email + notificación en app)
        if (preg_match_all('/@(\w+)/', $commentBody, $m)) {
            foreach (array_unique($m[1]) as $username) {
                $mentioned = $db->table('users')->where('username', $username)->get()->getRowArray();
                if ($mentioned) {
                    // Email
                    if ($mentioned['email_notifications'] ?? 1) {
                        EmailService::mention($mentioned['email'], $mentioned['first_name'], $byName, $task['title'] ?? '', "{$frontUrl}{$taskUrl}");
                    }
                    // Notificación en app
                    NotificationService::notify(
                        (int)$mentioned['id'],
                        'mention',
                        "{$byName} te mencionó en \"{$task['title']}\"",
                        mb_substr(strip_tags($commentBody), 0, 200),
                        $taskUrl,
                        $projectId,
                        'task',
                        $taskId
                    );
                }
            }
        }

        // 2. Notificar a asignados de la tarea (nuevo comentario)
        if ($task && $projectId) {
            NotificationService::notifyTaskAssignees(
                $taskId,
                (int)$projectId,
                'task_comment',
                "Nuevo comentario en \"{$task['title']}\"",
                "{$byName}: " . mb_substr(strip_tags($commentBody), 0, 150),
                $taskUrl
            );
        }

        return $this->response->setStatusCode(201)->setJSON($inserted);
    }

    /**
     * PUT/PATCH /api/task-comments/{id}
     */
    public function update(int $id): ResponseInterface
    {
        $comment = $this->model->find($id);
        if (!$comment) {
            return $this->response->setStatusCode(404)->setJSON(['message' => 'Comentario no encontrado']);
        }
        if ((int)$comment['user_id'] !== Auth::id()) {
            return $this->response->setStatusCode(403)->setJSON(['message' => 'Sin permiso para editar este comentario']);
        }

        $data = $this->request->getJSON(true) ?? $this->request->getPost();
        $this->model->update($id, ['body' => $data['body'] ?? $comment['body']]);

        // Return with author info
        $updated = $this->model->findByTask((int)$comment['task_id']);
        $updated = array_values(array_filter($updated, fn($c) => (int)$c['id'] === $id))[0] ?? $this->model->find($id);

        return $this->response->setJSON($updated);
    }

    /**
     * DELETE /api/task-comments/{id}
     */
    public function delete(int $id): ResponseInterface
    {
        $comment = $this->model->find($id);
        if (!$comment) {
            return $this->response->setStatusCode(404)->setJSON(['message' => 'Comentario no encontrado']);
        }
        if ((int)$comment['user_id'] !== Auth::id()) {
            return $this->response->setStatusCode(403)->setJSON(['message' => 'Sin permiso para eliminar este comentario']);
        }

        $this->model->delete($id);
        return $this->response->setStatusCode(204)->setBody('');
    }
}
