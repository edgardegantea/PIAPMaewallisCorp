<?php
namespace App\Controllers\Api;
use App\Controllers\BaseController;
use App\Libraries\Auth;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

class WeeklyReportsController extends BaseController
{
    public function index(int $projectId): ResponseInterface
    {
        return $this->response->setJSON(Database::connect()->query("
            SELECT wr.*,CONCAT(u.first_name,' ',u.last_name) AS author_name
            FROM weekly_reports wr LEFT JOIN users u ON u.id=wr.author_id
            WHERE wr.project_id=? ORDER BY wr.week_start DESC LIMIT 20
        ",[$projectId])->getResultArray());
    }

    public function create(int $projectId): ResponseInterface
    {
        $db = Database::connect(); $data = $this->request->getJSON(true);
        // Auto-compute metrics snapshot
        $metrics = $db->query("
            SELECT COUNT(*) AS total,SUM(status='COMPLETADA') AS done,SUM(status='BLOQUEADA') AS blocked,
                   SUM(due_date<CURDATE() AND status!='COMPLETADA') AS overdue
            FROM tasks t JOIN sprints s ON s.id=t.sprint_id WHERE s.project_id=?
        ",[$projectId])->getRowArray();

        $weekStart = $data['week_start'] ?? date('Y-m-d', strtotime('monday this week'));
        $db->table('weekly_reports')->insert(['project_id'=>$projectId,'author_id'=>Auth::id(),'week_start'=>$weekStart,'rag'=>$data['rag']??'GREEN','highlights'=>$data['highlights']??null,'blockers'=>$data['blockers']??null,'next_steps'=>$data['next_steps']??null,'metrics_snapshot'=>json_encode($metrics),'created_at'=>date('Y-m-d H:i:s')]);
        return $this->response->setStatusCode(201)->setJSON($db->table('weekly_reports')->where('id',$db->insertID())->get()->getRowArray());
    }

    public function update(int $id): ResponseInterface
    {
        $db = Database::connect(); $data = $this->request->getJSON(true);
        $db->table('weekly_reports')->where('id',$id)->update(array_intersect_key($data,array_flip(['rag','highlights','blockers','next_steps'])));
        return $this->response->setJSON($db->table('weekly_reports')->where('id',$id)->get()->getRowArray());
    }

    public function delete(int $id): ResponseInterface { Database::connect()->table('weekly_reports')->where('id',$id)->delete(); return $this->response->setStatusCode(204)->setBody(''); }
}
