<?php
namespace App\Controllers\Api;
use App\Controllers\BaseController;
use App\Libraries\Auth;
use App\Libraries\EmailService;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

class AnnouncementsController extends BaseController
{
    public function index(int $projectId): ResponseInterface
    {
        $db = Database::connect();
        $uid = Auth::id();
        return $this->response->setJSON($db->query("
            SELECT a.*, CONCAT(u.first_name,' ',u.last_name) AS author_name, u.username,
                   (SELECT COUNT(*) FROM announcement_reads r WHERE r.announcement_id=a.id) AS read_count,
                   (SELECT 1 FROM announcement_reads r2 WHERE r2.announcement_id=a.id AND r2.user_id=?) AS is_read
            FROM project_announcements a JOIN users u ON u.id=a.author_id
            WHERE a.project_id=? ORDER BY a.pinned DESC, a.created_at DESC
        ", [$uid, $projectId])->getResultArray());
    }

    public function create(int $projectId): ResponseInterface
    {
        $db = Database::connect(); $data = $this->request->getJSON(true);
        if (empty($data['title'])||empty($data['body'])) return $this->response->setStatusCode(422)->setJSON(['message'=>'title y body requeridos']);
        $db->table('project_announcements')->insert(['project_id'=>$projectId,'author_id'=>Auth::id(),'title'=>$data['title'],'body'=>$data['body'],'pinned'=>$data['pinned']??0,'created_at'=>date('Y-m-d H:i:s'),'updated_at'=>date('Y-m-d H:i:s')]);
        $id = $db->insertID();

        // Email to team members
        $members = $db->query("SELECT u.email,u.first_name FROM project_members pm JOIN users u ON u.id=pm.user_id WHERE pm.project_id=? AND u.email_notifications=1 AND u.id!=?"  ,[$projectId,Auth::id()])->getResultArray();
        $frontUrl = env('APP_FRONTEND_URL','https://piap.maewalliscorp.org');
        foreach ($members as $m) {
            EmailService::send($m['email'],"[Anuncio] {$data['title']}",
                "<p>Hola {$m['first_name']},</p><p>Nuevo anuncio en el proyecto:<br><strong>{$data['title']}</strong></p><p>{$data['body']}</p><p><a href='{$frontUrl}'>Ver proyecto</a></p>");
        }

        return $this->response->setStatusCode(201)->setJSON($db->table('project_announcements')->where('id',$id)->get()->getRowArray());
    }

    public function update(int $id): ResponseInterface
    {
        $db = Database::connect(); $data = $this->request->getJSON(true);
        $db->table('project_announcements')->where('id',$id)->update(array_intersect_key($data,array_flip(['title','body','pinned']))+['updated_at'=>date('Y-m-d H:i:s')]);
        return $this->response->setJSON($db->table('project_announcements')->where('id',$id)->get()->getRowArray());
    }

    public function delete(int $id): ResponseInterface { Database::connect()->table('project_announcements')->where('id',$id)->delete(); return $this->response->setStatusCode(204)->setBody(''); }

    public function markRead(int $id): ResponseInterface
    {
        Database::connect()->query("INSERT IGNORE INTO announcement_reads (announcement_id,user_id,read_at) VALUES (?,?,NOW())",[  $id,Auth::id()]);
        return $this->response->setJSON(['ok'=>true]);
    }
}
