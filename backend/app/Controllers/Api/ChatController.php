<?php
namespace App\Controllers\Api;
use App\Controllers\BaseController;
use App\Libraries\Auth;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

class ChatController extends BaseController
{
    public function index(int $projectId): ResponseInterface
    {
        $db = Database::connect();
        $since = $this->request->getGet('since');
        $q = $db->query("
            SELECT m.*, CONCAT(u.first_name,' ',u.last_name) AS user_name, u.username
            FROM project_chat_messages m LEFT JOIN users u ON u.id = m.user_id
            WHERE m.project_id = ? " . ($since ? "AND m.id > ?" : "") . "
            ORDER BY m.created_at ASC LIMIT 100
        ", $since ? [$projectId,(int)$since] : [$projectId]);
        return $this->response->setJSON($q->getResultArray());
    }
    public function create(int $projectId): ResponseInterface
    {
        $db = Database::connect(); $data = $this->request->getJSON(true);
        $body = trim($data['body']??'');
        if (!$body) return $this->response->setStatusCode(422)->setJSON(['message'=>'Mensaje vacío']);
        $db->table('project_chat_messages')->insert(['project_id'=>$projectId,'user_id'=>Auth::id(),'body'=>$body,'created_at'=>date('Y-m-d H:i:s')]);
        $id = $db->insertID();
        $row = $db->query("SELECT m.*,CONCAT(u.first_name,' ',u.last_name) AS user_name,u.username FROM project_chat_messages m LEFT JOIN users u ON u.id=m.user_id WHERE m.id=?",[$id])->getRowArray();
        return $this->response->setStatusCode(201)->setJSON($row);
    }
    public function delete(int $id): ResponseInterface
    {
        $db = Database::connect(); $row = $db->table('project_chat_messages')->where('id',$id)->get()->getRowArray();
        if (!$row) return $this->response->setStatusCode(404)->setJSON(['message'=>'No encontrado']);
        if ((int)$row['user_id'] !== Auth::id()) return $this->response->setStatusCode(403)->setJSON(['message'=>'Sin permiso']);
        $db->table('project_chat_messages')->where('id',$id)->delete();
        return $this->response->setStatusCode(204)->setBody('');
    }
}
