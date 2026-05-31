<?php
namespace App\Controllers\Api;
use App\Controllers\BaseController;
use App\Libraries\Auth;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

/**
 * DescriptionHistoryController — Historial de cambios de descripción de tareas (#24)
 * Cada vez que se actualiza la descripción de una tarea se guarda una versión.
 * El registro se hace en TasksController::update() (ver integración abajo).
 */
class DescriptionHistoryController extends BaseController
{
    /** GET /tasks/:taskId/description-history */
    public function index(int $taskId): ResponseInterface
    {
        $rows = Database::connect()
            ->table('task_description_history h')
            ->select('h.*, u.first_name, u.last_name, u.username')
            ->join('users u', 'u.id = h.changed_by', 'left')
            ->where('h.task_id', $taskId)
            ->orderBy('h.created_at', 'DESC')
            ->limit(50)
            ->get()->getResultArray();

        return $this->response->setJSON($rows);
    }

    /**
     * Registra una nueva versión de descripción.
     * Se llama internamente desde TasksController::update() cuando description cambia.
     */
    public static function record(int $taskId, string $oldDescription, string $newDescription): void
    {
        if (trim($oldDescription) === trim($newDescription)) return;
        Database::connect()->table('task_description_history')->insert([
            'task_id'         => $taskId,
            'old_description' => $oldDescription,
            'new_description' => $newDescription,
            'changed_by'      => Auth::id(),
            'created_at'      => date('Y-m-d H:i:s'),
        ]);
    }

    /** GET /tasks/:taskId/description-history/:version — restaurar una versión */
    public function restore(int $taskId, int $versionId): ResponseInterface
    {
        $db      = Database::connect();
        $version = $db->table('task_description_history')
            ->where('id', $versionId)
            ->where('task_id', $taskId)
            ->get()->getRowArray();

        if (!$version) {
            return $this->response->setStatusCode(404)->setJSON(['message' => 'Versión no encontrada']);
        }

        // Get current description before restoring
        $task = $db->table('tasks')->where('id', $taskId)->get()->getRowArray();
        $currentDesc = $task['description'] ?? '';

        // Restore
        $db->table('tasks')->where('id', $taskId)->update([
            'description' => $version['old_description'],
            'updated_at'  => date('Y-m-d H:i:s'),
        ]);

        // Record this restoration as a new history entry
        self::record($taskId, $currentDesc, $version['old_description']);

        return $this->response->setJSON(['message' => 'Descripción restaurada', 'description' => $version['old_description']]);
    }
}
