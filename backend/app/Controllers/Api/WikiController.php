<?php
namespace App\Controllers\Api;
use App\Controllers\BaseController;
use App\Libraries\Auth;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

class WikiController extends BaseController
{
    public function index(int $projectId): ResponseInterface
    {
        $db = Database::connect();
        return $this->response->setJSON($db->query("
            SELECT w.id,w.parent_id,w.title,w.slug,w.sort_order,w.created_at,w.updated_at,
                   CONCAT(u.first_name,' ',u.last_name) AS created_by_name,
                   CONCAT(u2.first_name,' ',u2.last_name) AS updated_by_name
            FROM wiki_pages w LEFT JOIN users u ON u.id=w.created_by LEFT JOIN users u2 ON u2.id=w.updated_by
            WHERE w.project_id=? ORDER BY w.sort_order,w.title
        ",[$projectId])->getResultArray());
    }
    public function show(int $id): ResponseInterface
    {
        $db = Database::connect();
        $page = $db->query("SELECT w.*,CONCAT(u.first_name,' ',u.last_name) AS created_by_name FROM wiki_pages w LEFT JOIN users u ON u.id=w.created_by WHERE w.id=?",[$id])->getRowArray();
        if (!$page) return $this->response->setStatusCode(404)->setJSON(['message'=>'Página no encontrada']);
        return $this->response->setJSON($page);
    }
    public function create(int $projectId): ResponseInterface
    {
        $db = Database::connect(); $data = $this->request->getJSON(true);
        if (empty($data['title'])) return $this->response->setStatusCode(422)->setJSON(['message'=>'Título requerido']);
        $slug = strtolower(preg_replace('/[^a-z0-9]+/i','-',trim($data['title'])));
        $db->table('wiki_pages')->insert(['project_id'=>$projectId,'parent_id'=>$data['parent_id']??null,'title'=>$data['title'],'slug'=>$slug.'-'.time(),'content'=>$data['content']??null,'created_by'=>Auth::id(),'updated_by'=>Auth::id(),'sort_order'=>$data['sort_order']??0,'created_at'=>date('Y-m-d H:i:s'),'updated_at'=>date('Y-m-d H:i:s')]);
        return $this->response->setStatusCode(201)->setJSON($db->table('wiki_pages')->where('id',$db->insertID())->get()->getRowArray());
    }
    public function update(int $id): ResponseInterface
    {
        $db = Database::connect(); $data = $this->request->getJSON(true);
        $allowed = ['title','content','parent_id','sort_order'];
        $payload = array_intersect_key($data,array_flip($allowed));
        $payload['updated_by'] = Auth::id();
        $payload['updated_at'] = date('Y-m-d H:i:s');
        $db->table('wiki_pages')->where('id',$id)->update($payload);
        return $this->response->setJSON($db->table('wiki_pages')->where('id',$id)->get()->getRowArray());
    }
    public function delete(int $id): ResponseInterface { Database::connect()->table('wiki_pages')->where('id',$id)->delete(); return $this->response->setStatusCode(204)->setBody(''); }
}
