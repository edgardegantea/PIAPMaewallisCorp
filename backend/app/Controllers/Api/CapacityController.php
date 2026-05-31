<?php
namespace App\Controllers\Api;
use App\Controllers\BaseController;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

class CapacityController extends BaseController
{
    public function index(int $sprintId): ResponseInterface
    {
        $db = Database::connect();
        $members = $db->query("
            SELECT u.id AS user_id, CONCAT(u.first_name,' ',u.last_name) AS user_name, u.username,
                   COALESCE(sc.available_hours,40) AS available_hours, sc.notes,
                   COALESCE(SUM(t.estimated_hours),0) AS assigned_hours,
                   COALESCE(SUM(t.story_points),0) AS assigned_points
            FROM sprints s
            JOIN projects p ON p.id = s.project_id
            JOIN project_members pm ON pm.project_id = p.id
            JOIN users u ON u.id = pm.user_id
            LEFT JOIN sprint_capacity sc ON sc.sprint_id = s.id AND sc.user_id = u.id
            LEFT JOIN tasks t ON t.sprint_id = s.id AND t.assigned_to = u.id AND t.parent_task_id IS NULL
            WHERE s.id = ?
            GROUP BY u.id
            ORDER BY u.first_name
        ",[$sprintId])->getResultArray();
        return $this->response->setJSON($members);
    }
    public function upsert(int $sprintId): ResponseInterface
    {
        $db = Database::connect();
        $entries = $this->request->getJSON(true)['capacity'] ?? [];
        foreach ($entries as $e) {
            $db->query("INSERT INTO sprint_capacity (sprint_id,user_id,available_hours,notes) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE available_hours=VALUES(available_hours),notes=VALUES(notes)",[$sprintId,$e['user_id'],$e['available_hours']??40,$e['notes']??null]);
        }
        return $this->response->setJSON(['ok'=>true]);
    }
}
