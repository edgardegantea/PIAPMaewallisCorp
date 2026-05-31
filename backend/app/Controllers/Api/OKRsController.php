<?php
namespace App\Controllers\Api;
use App\Controllers\BaseController;
use App\Libraries\Auth;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

class OKRsController extends BaseController
{
    public function index(): ResponseInterface
    {
        $db = Database::connect();
        $projectId = $this->request->getGet('project_id');
        $period    = $this->request->getGet('period');
        $q = $db->table('okr_objectives o')
            ->select('o.*, CONCAT(u.first_name," ",u.last_name) AS owner_name, p.name AS project_name')
            ->join('users u','u.id = o.owner_id','left')
            ->join('projects p','p.id = o.project_id','left');
        if ($projectId) $q->where('o.project_id',$projectId);
        if ($period)    $q->where('o.period',$period);
        $objectives = $q->orderBy('o.created_at','DESC')->get()->getResultArray();
        foreach ($objectives as &$obj) {
            $krs = $db->table('okr_key_results')->where('objective_id',$obj['id'])->get()->getResultArray();
            $total = count($krs);
            $obj['key_results'] = $krs;
            $obj['progress'] = $total > 0 ? round(array_sum(array_map(fn($kr)=>$kr['target_value']>0?min(100,($kr['current_value']/$kr['target_value'])*100):0,$krs))/$total) : 0;
        }
        return $this->response->setJSON($objectives);
    }
    public function create(): ResponseInterface
    {
        $db = Database::connect(); $data = $this->request->getJSON(true);
        if (empty($data['title'])) return $this->response->setStatusCode(422)->setJSON(['message'=>'Título requerido']);
        $db->table('okr_objectives')->insert(['title'=>$data['title'],'description'=>$data['description']??null,'project_id'=>$data['project_id']??null,'owner_id'=>$data['owner_id']??Auth::id(),'period'=>$data['period']??null,'status'=>$data['status']??'ON_TRACK','created_at'=>date('Y-m-d H:i:s'),'updated_at'=>date('Y-m-d H:i:s')]);
        return $this->response->setStatusCode(201)->setJSON($db->table('okr_objectives')->where('id',$db->insertID())->get()->getRowArray());
    }
    public function update(int $id): ResponseInterface
    {
        $db = Database::connect(); $data = $this->request->getJSON(true);
        $payload = array_intersect_key($data,array_flip(['title','description','project_id','owner_id','period','status']));
        $payload['updated_at'] = date('Y-m-d H:i:s');
        $db->table('okr_objectives')->where('id',$id)->update($payload);
        return $this->response->setJSON($db->table('okr_objectives')->where('id',$id)->get()->getRowArray());
    }
    public function delete(int $id): ResponseInterface { Database::connect()->table('okr_objectives')->where('id',$id)->delete(); return $this->response->setStatusCode(204)->setBody(''); }
    public function keyResults(int $objectiveId): ResponseInterface { return $this->response->setJSON(Database::connect()->table('okr_key_results')->where('objective_id',$objectiveId)->get()->getResultArray()); }
    public function createKR(int $objectiveId): ResponseInterface
    {
        $db = Database::connect(); $data = $this->request->getJSON(true);
        if (empty($data['title'])) return $this->response->setStatusCode(422)->setJSON(['message'=>'Título requerido']);
        $db->table('okr_key_results')->insert(['objective_id'=>$objectiveId,'title'=>$data['title'],'target_value'=>(float)($data['target_value']??100),'current_value'=>(float)($data['current_value']??0),'unit'=>$data['unit']??'%','created_at'=>date('Y-m-d H:i:s'),'updated_at'=>date('Y-m-d H:i:s')]);
        return $this->response->setStatusCode(201)->setJSON($db->table('okr_key_results')->where('id',$db->insertID())->get()->getRowArray());
    }
    public function updateKR(int $id): ResponseInterface
    {
        $db = Database::connect(); $data = $this->request->getJSON(true);
        $payload = array_intersect_key($data,array_flip(['title','target_value','current_value','unit']));
        $payload['updated_at'] = date('Y-m-d H:i:s');
        $db->table('okr_key_results')->where('id',$id)->update($payload);
        return $this->response->setJSON($db->table('okr_key_results')->where('id',$id)->get()->getRowArray());
    }
    public function deleteKR(int $id): ResponseInterface { Database::connect()->table('okr_key_results')->where('id',$id)->delete(); return $this->response->setStatusCode(204)->setBody(''); }
}
