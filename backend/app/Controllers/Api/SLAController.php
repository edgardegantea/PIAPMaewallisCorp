<?php
namespace App\Controllers\Api;
use App\Controllers\BaseController;
use App\Libraries\Auth;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

class SLAController extends BaseController
{
    public function policies(int $projectId): ResponseInterface
    {
        return $this->response->setJSON(Database::connect()->table('sla_policies')->where('project_id',$projectId)->orWhere('project_id IS NULL')->get()->getResultArray());
    }
    public function createPolicy(int $projectId): ResponseInterface
    {
        $db = Database::connect(); $data = $this->request->getJSON(true);
        if (empty($data['name'])) return $this->response->setStatusCode(422)->setJSON(['message'=>'Nombre requerido']);
        $db->table('sla_policies')->insert(['project_id'=>$projectId,'name'=>$data['name'],'applies_to'=>$data['applies_to']??'ALL','response_hours'=>$data['response_hours']??4,'resolution_hours'=>$data['resolution_hours']??24,'is_active'=>1,'created_at'=>date('Y-m-d H:i:s')]);
        return $this->response->setStatusCode(201)->setJSON($db->table('sla_policies')->where('id',$db->insertID())->get()->getRowArray());
    }
    public function updatePolicy(int $id): ResponseInterface
    {
        $db = Database::connect(); $data = $this->request->getJSON(true);
        $db->table('sla_policies')->where('id',$id)->update(array_intersect_key($data,array_flip(['name','applies_to','response_hours','resolution_hours','is_active'])));
        return $this->response->setJSON($db->table('sla_policies')->where('id',$id)->get()->getRowArray());
    }
    public function deletePolicy(int $id): ResponseInterface { Database::connect()->table('sla_policies')->where('id',$id)->delete(); return $this->response->setStatusCode(204)->setBody(''); }

    public function dashboard(int $projectId): ResponseInterface
    {
        $db = Database::connect();
        $rows = $db->query("
            SELECT t.id,t.title,t.priority,t.status,t.created_at,
                   ts.response_deadline,ts.resolution_deadline,ts.response_breached,ts.resolution_breached,
                   CONCAT(u.first_name,' ',u.last_name) AS assignee,sp.name AS policy_name
            FROM task_sla ts
            JOIN tasks t ON t.id=ts.task_id
            JOIN sla_policies sp ON sp.id=ts.policy_id
            LEFT JOIN users u ON u.id=t.assigned_to
            JOIN sprints s ON s.id=t.sprint_id
            WHERE s.project_id=? AND t.status!='COMPLETADA'
            ORDER BY ts.resolution_deadline ASC
        ",[$projectId])->getResultArray();
        // Check breaches
        $now = date('Y-m-d H:i:s');
        foreach ($rows as &$r) {
            $r['response_breached']   = ($r['response_breached'] || ($r['response_deadline'] && $r['response_deadline'] < $now)) ? 1 : 0;
            $r['resolution_breached'] = ($r['resolution_breached'] || ($r['resolution_deadline'] && $r['resolution_deadline'] < $now)) ? 1 : 0;
        }
        return $this->response->setJSON($rows);
    }

    /** Apply SLA policy to a task (called when task is created with matching priority) */
    public static function applyToTask(int $taskId, string $priority, int $projectId): void
    {
        try {
            $db = Database::connect();
            $policy = $db->query("SELECT * FROM sla_policies WHERE (project_id=? OR project_id IS NULL) AND (applies_to=? OR applies_to='ALL') AND is_active=1 ORDER BY project_id DESC LIMIT 1",[$projectId,$priority])->getRowArray();
            if (!$policy) return;
            $task = $db->table('tasks')->where('id',$taskId)->get()->getRowArray();
            $createdAt = new \DateTime($task['created_at'] ?? 'now');
            $responseDeadline  = (clone $createdAt)->modify("+{$policy['response_hours']} hours");
            $resolutionDeadline= (clone $createdAt)->modify("+{$policy['resolution_hours']} hours");
            $db->query("INSERT IGNORE INTO task_sla (task_id,policy_id,response_deadline,resolution_deadline) VALUES (?,?,?,?)",[$taskId,$policy['id'],$responseDeadline->format('Y-m-d H:i:s'),$resolutionDeadline->format('Y-m-d H:i:s')]);
        } catch (\Throwable $e) { log_message('error','SLAController::applyToTask: '.$e->getMessage()); }
    }
}
