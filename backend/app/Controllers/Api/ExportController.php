<?php
namespace App\Controllers\Api;
use App\Controllers\BaseController;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

/**
 * Data exports.
 * GET /api/projects/:id/export/excel  — returns JSON structured for xlsx generation on frontend
 */
class ExportController extends BaseController
{
    public function excel(int $projectId): ResponseInterface
    {
        $db = Database::connect();
        $project = $db->table('projects')->where('id',$projectId)->get()->getRowArray();
        if (!$project) return $this->response->setStatusCode(404)->setJSON(['message'=>'Proyecto no encontrado']);

        $tasks = $db->query("
            SELECT t.title,t.status,t.priority,t.estimated_hours,t.story_points,t.due_date,t.created_at,
                   s.name AS sprint, CONCAT(u.first_name,' ',u.last_name) AS assignee
            FROM tasks t JOIN sprints s ON s.id=t.sprint_id LEFT JOIN users u ON u.id=t.assigned_to
            WHERE s.project_id=? AND t.parent_task_id IS NULL ORDER BY s.number,t.id
        ",[$projectId])->getResultArray();

        $timeLogs = $db->query("
            SELECT tl.work_date,tl.hours,tl.description,t.title AS task,
                   CONCAT(u.first_name,' ',u.last_name) AS user, s.name AS sprint
            FROM task_time_logs tl JOIN tasks t ON t.id=tl.task_id JOIN sprints s ON s.id=t.sprint_id JOIN users u ON u.id=tl.user_id
            WHERE s.project_id=? ORDER BY tl.work_date DESC
        ",[$projectId])->getResultArray();

        $members = $db->query("
            SELECT CONCAT(u.first_name,' ',u.last_name) AS name,u.username,u.email,pm.role
            FROM project_members pm JOIN users u ON u.id=pm.user_id WHERE pm.project_id=?
        ",[$projectId])->getResultArray();

        $risks = $db->query("SELECT description,probability,impact,status,category FROM risks WHERE project_id=?",[$projectId])->getResultArray();

        return $this->response->setJSON([
            'project'   => $project,
            'sheets'    => [
                ['name'=>'Tareas',    'data'=>$tasks],
                ['name'=>'Registros de Tiempo','data'=>$timeLogs],
                ['name'=>'Equipo',    'data'=>$members],
                ['name'=>'Riesgos',   'data'=>$risks],
            ],
        ]);
    }
}
