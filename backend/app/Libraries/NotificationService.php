<?php
namespace App\Libraries;
use Config\Database;

/**
 * NotificationService — crea notificaciones persistentes en user_notifications.
 *
 * Uso:
 *   NotificationService::notify($userId, 'task_assigned', 'Te asignaron una tarea', 'Título tarea', '/projects/5?tab=kanban');
 *   NotificationService::notifyMany([1,2,3], 'announcement', 'Nuevo anuncio', '...', '/projects/5?tab=announcements');
 */
class NotificationService
{
    /**
     * Crea una notificación para un usuario.
     */
    public static function notify(
        int    $userId,
        string $type,
        string $title,
        string $body        = '',
        string $link        = '',
        ?int   $projectId   = null,
        string $entityType  = '',
        ?int   $entityId    = null
    ): void {
        try {
            // No notificar al propio usuario que dispara el evento
            $currentUserId = \App\Libraries\Auth::id();
            if ($currentUserId && $currentUserId === $userId) return;

            // Evitar duplicados recientes (misma notificación en los últimos 5 min)
            $db     = Database::connect();
            $recent = $db->table('user_notifications')
                ->where('user_id',   $userId)
                ->where('type',      $type)
                ->where('entity_id', $entityId)
                ->where('created_at >=', date('Y-m-d H:i:s', strtotime('-5 minutes')))
                ->countAllResults();
            if ($recent > 0) return;

            $db->table('user_notifications')->insert([
                'user_id'     => $userId,
                'type'        => $type,
                'title'       => mb_substr($title, 0, 255),
                'body'        => mb_substr($body,  0, 500),
                'link'        => mb_substr($link,  0, 500),
                'entity_type' => $entityType ?: null,
                'entity_id'   => $entityId,
                'project_id'  => $projectId,
                'is_read'     => 0,
                'created_at'  => date('Y-m-d H:i:s'),
            ]);
        } catch (\Throwable $e) {
            log_message('error', 'NotificationService::notify: ' . $e->getMessage());
        }
    }

    /**
     * Crea la misma notificación para múltiples usuarios.
     */
    public static function notifyMany(
        array  $userIds,
        string $type,
        string $title,
        string $body       = '',
        string $link       = '',
        ?int   $projectId  = null,
        string $entityType = '',
        ?int   $entityId   = null
    ): void {
        foreach (array_unique($userIds) as $uid) {
            self::notify((int)$uid, $type, $title, $body, $link, $projectId, $entityType, $entityId);
        }
    }

    /**
     * Notifica a todos los miembros activos de un proyecto (excepto el actor).
     */
    public static function notifyProjectMembers(
        int    $projectId,
        string $type,
        string $title,
        string $body      = '',
        string $link      = '',
        string $entityType = '',
        ?int   $entityId  = null
    ): void {
        try {
            $db  = Database::connect();
            $members = $db->query(
                "SELECT DISTINCT user_id FROM project_members WHERE project_id = ?
                 UNION SELECT director_id FROM projects WHERE id = ? AND director_id IS NOT NULL",
                [$projectId, $projectId]
            )->getResultArray();
            $ids = array_column($members, 'user_id');
            self::notifyMany($ids, $type, $title, $body, $link, $projectId, $entityType, $entityId);
        } catch (\Throwable $e) {
            log_message('error', 'NotificationService::notifyProjectMembers: ' . $e->getMessage());
        }
    }

    /**
     * Notifica a los asignados de una tarea (excepto el actor).
     */
    public static function notifyTaskAssignees(
        int    $taskId,
        int    $projectId,
        string $type,
        string $title,
        string $body      = '',
        string $link      = ''
    ): void {
        try {
            $db  = Database::connect();
            $rows = $db->table('task_assignees')->where('task_id', $taskId)->get()->getResultArray();
            $ids  = array_column($rows, 'user_id');
            self::notifyMany($ids, $type, $title, $body, $link, $projectId, 'task', $taskId);
        } catch (\Throwable $e) {
            log_message('error', 'NotificationService::notifyTaskAssignees: ' . $e->getMessage());
        }
    }
}
