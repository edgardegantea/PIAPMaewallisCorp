<?php
namespace App\Controllers\Api;
use App\Controllers\BaseController;
use App\Libraries\Auth;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

class SavedFiltersController extends BaseController
{
    public function index(): ResponseInterface
    {
        $projectId = $this->request->getGet('project_id');
        $db = Database::connect();
        $q = $db->table('saved_filters')->where('user_id',Auth::id());
        if ($projectId) $q->groupStart()->where('project_id',$projectId)->orWhere('project_id IS NULL')->groupEnd();
        return $this->response->setJSON($q->orderBy('name')->get()->getResultArray());
    }
    public function create(): ResponseInterface
    {
        $db = Database::connect(); $data = $this->request->getJSON(true);
        if (empty($data['name'])) return $this->response->setStatusCode(422)->setJSON(['message'=>'Nombre requerido']);
        $db->table('saved_filters')->insert(['user_id'=>Auth::id(),'project_id'=>$data['project_id']??null,'name'=>$data['name'],'filters'=>json_encode($data['filters']??[]),'created_at'=>date('Y-m-d H:i:s')]);
        return $this->response->setStatusCode(201)->setJSON($db->table('saved_filters')->where('id',$db->insertID())->get()->getRowArray());
    }
    public function delete(int $id): ResponseInterface { Database::connect()->table('saved_filters')->where('id',$id)->where('user_id',Auth::id())->delete(); return $this->response->setStatusCode(204)->setBody(''); }
}
