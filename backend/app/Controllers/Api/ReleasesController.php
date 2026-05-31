<?php
namespace App\Controllers\Api;
use App\Controllers\BaseController;
use App\Libraries\Auth;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

class ReleasesController extends BaseController
{
    public function index(int $projectId): ResponseInterface
    {
        $db = Database::connect();
        $releases = $db->query("SELECT r.*,(SELECT COUNT(*) FROM release_tasks rt WHERE rt.release_id=r.id) AS task_count FROM releases r WHERE r.project_id=? ORDER BY r.release_date DESC,r.id DESC",[$projectId])->getResultArray();
        return $this->response->setJSON($releases);
    }
    public function create(int $projectId): ResponseInterface
    {
        $db = Database::connect(); $data = $this->request->getJSON(true);
        if (empty($data['name'])) return $this->response->setStatusCode(422)->setJSON(['message'=>'Nombre requerido']);
        $db->table('releases')->insert(['project_id'=>$projectId,'name'=>$data['name'],'version'=>$data['version']??'','status'=>$data['status']??'PLANNED','release_date'=>$data['release_date']??null,'description'=>$data['description']??null,'created_by'=>Auth::id(),'created_at'=>date('Y-m-d H:i:s'),'updated_at'=>date('Y-m-d H:i:s')]);
        return $this->response->setStatusCode(201)->setJSON($db->table('releases')->where('id',$db->insertID())->get()->getRowArray());
    }
    public function update(int $id): ResponseInterface
    {
        $db = Database::connect(); $data = $this->request->getJSON(true);
        $db->table('releases')->where('id',$id)->update(array_intersect_key($data,array_flip(['name','version','status','release_date','description']))+['updated_at'=>date('Y-m-d H:i:s')]);
        return $this->response->setJSON($db->table('releases')->where('id',$id)->get()->getRowArray());
    }
    public function delete(int $id): ResponseInterface { Database::connect()->table('releases')->where('id',$id)->delete(); return $this->response->setStatusCode(204)->setBody(''); }

    // POST /releases/:id/tasks { task_ids: [] }
    public function addTasks(int $releaseId): ResponseInterface
    {
        $db = Database::connect(); $ids = $this->request->getJSON(true)['task_ids'] ?? [];
        foreach ($ids as $tid) { $db->query("INSERT IGNORE INTO release_tasks (release_id,task_id) VALUES (?,?)",[$releaseId,$tid]); }
        return $this->response->setJSON(['ok'=>true,'added'=>count($ids)]);
    }

    // GET /releases/:id/tasks
    public function tasks(int $releaseId): ResponseInterface
    {
        return $this->response->setJSON(Database::connect()->query("SELECT t.*,s.name AS sprint_name FROM release_tasks rt JOIN tasks t ON t.id=rt.task_id JOIN sprints s ON s.id=t.sprint_id WHERE rt.release_id=? ORDER BY t.status,t.id",[$releaseId])->getResultArray());
    }

    // POST /releases/:id/generate-changelog — auto-generates changelog from completed tasks
    public function generateChangelog(int $releaseId): ResponseInterface
    {
        $db = Database::connect();
        $tasks = $db->query("SELECT t.title,t.priority,t.status FROM release_tasks rt JOIN tasks t ON t.id=rt.task_id WHERE rt.release_id=? ORDER BY t.priority DESC,t.title",[$releaseId])->getResultArray();
        $sections = ['CRITICA'=>'🚨 Críticos','ALTA'=>'🔥 Alta prioridad','MEDIA'=>'✨ Mejoras','BAJA'=>'🔧 Menores'];
        $changelog = '';
        foreach ($sections as $pri => $label) {
            $group = array_filter($tasks, fn($t)=>$t['priority']===$pri && $t['status']==='COMPLETADA');
            if ($group) { $changelog .= "## {$label}\n"; foreach ($group as $t) $changelog .= "- {$t['title']}\n"; $changelog .= "\n"; }
        }
        $db->table('releases')->where('id',$releaseId)->update(['changelog'=>$changelog,'updated_at'=>date('Y-m-d H:i:s')]);
        return $this->response->setJSON(['changelog'=>$changelog]);
    }
}
