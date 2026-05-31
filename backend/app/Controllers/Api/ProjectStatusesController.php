<?php
namespace App\Controllers\Api;
use App\Controllers\BaseController;
use App\Libraries\Auth;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

class ProjectStatusesController extends BaseController
{
    public function index(int $projectId): ResponseInterface
    {
        return $this->response->setJSON(Database::connect()->table('project_statuses')->where('project_id',$projectId)->orderBy('position')->get()->getResultArray());
    }
    public function create(int $projectId): ResponseInterface
    {
        $db = Database::connect(); $data = $this->request->getJSON(true);
        if (empty($data['name'])) return $this->response->setStatusCode(422)->setJSON(['message'=>'Nombre requerido']);
        $pos = ($db->table('project_statuses')->where('project_id',$projectId)->selectMax('position')->get()->getRowArray()['position'] ?? 0) + 1;
        $db->table('project_statuses')->insert(['project_id'=>$projectId,'name'=>$data['name'],'color'=>$data['color']??'#6366f1','position'=>$pos,'is_default'=>$data['is_default']??0,'maps_to'=>$data['maps_to']??'PENDIENTE']);
        return $this->response->setStatusCode(201)->setJSON($db->table('project_statuses')->where('id',$db->insertID())->get()->getRowArray());
    }
    public function update(int $id): ResponseInterface
    {
        $db = Database::connect(); $data = $this->request->getJSON(true);
        $db->table('project_statuses')->where('id',$id)->update(array_intersect_key($data,array_flip(['name','color','position','is_default','maps_to'])));
        return $this->response->setJSON($db->table('project_statuses')->where('id',$id)->get()->getRowArray());
    }
    public function delete(int $id): ResponseInterface { Database::connect()->table('project_statuses')->where('id',$id)->delete(); return $this->response->setStatusCode(204)->setBody(''); }
}
