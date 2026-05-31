<?php
namespace App\Controllers\Api;
use App\Controllers\BaseController;
use App\Libraries\Auth;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

class CustomFieldsController extends BaseController
{
    public function index(int $projectId): ResponseInterface
    {
        return $this->response->setJSON(Database::connect()->table('custom_fields')->where('project_id',$projectId)->orWhere('project_id IS NULL')->orderBy('sort_order')->get()->getResultArray());
    }
    public function create(int $projectId): ResponseInterface
    {
        $db = Database::connect(); $data = $this->request->getJSON(true);
        if (empty($data['name'])||empty($data['field_type'])) return $this->response->setStatusCode(422)->setJSON(['message'=>'name y field_type requeridos']);
        $key = strtolower(preg_replace('/[^a-z0-9_]/','_',$data['name'])).time();
        $db->table('custom_fields')->insert(['project_id'=>$projectId,'name'=>$data['name'],'field_key'=>$key,'field_type'=>$data['field_type'],'options'=>isset($data['options'])?json_encode($data['options']):null,'is_required'=>$data['is_required']??0,'sort_order'=>$data['sort_order']??0,'created_at'=>date('Y-m-d H:i:s')]);
        return $this->response->setStatusCode(201)->setJSON($db->table('custom_fields')->where('id',$db->insertID())->get()->getRowArray());
    }
    public function update(int $id): ResponseInterface
    {
        $db = Database::connect(); $data = $this->request->getJSON(true);
        $p = array_intersect_key($data,array_flip(['name','options','is_required','sort_order']));
        if (isset($p['options'])) $p['options'] = json_encode($p['options']);
        $db->table('custom_fields')->where('id',$id)->update($p);
        return $this->response->setJSON($db->table('custom_fields')->where('id',$id)->get()->getRowArray());
    }
    public function delete(int $id): ResponseInterface { Database::connect()->table('custom_fields')->where('id',$id)->delete(); return $this->response->setStatusCode(204)->setBody(''); }

    // GET/PUT /tasks/:id/custom-values
    public function getTaskValues(int $taskId): ResponseInterface
    {
        $db = Database::connect();
        $rows = $db->query("SELECT cf.*, tcv.value FROM custom_fields cf LEFT JOIN task_custom_values tcv ON tcv.field_id=cf.id AND tcv.task_id=? ORDER BY cf.sort_order",[$taskId])->getResultArray();
        return $this->response->setJSON($rows);
    }
    public function setTaskValues(int $taskId): ResponseInterface
    {
        $db = Database::connect(); $values = $this->request->getJSON(true)['values'] ?? [];
        foreach ($values as $fieldId => $val) {
            $db->query("INSERT INTO task_custom_values (task_id,field_id,value) VALUES (?,?,?) ON DUPLICATE KEY UPDATE value=VALUES(value)",[$taskId,$fieldId,$val]);
        }
        return $this->response->setJSON(['ok'=>true]);
    }
}
