<?php
namespace App\Controllers\Api;
use App\Controllers\BaseController;
use App\Libraries\Auth;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

class WebhooksController extends BaseController
{
    public function index(): ResponseInterface
    {
        $db = Database::connect(); $projectId = $this->request->getGet('project_id');
        $q = $db->table('webhooks w')->select('w.*,p.name AS project_name')->join('projects p','p.id=w.project_id','left');
        if ($projectId) $q->where('w.project_id',$projectId);
        return $this->response->setJSON($q->get()->getResultArray());
    }
    public function create(): ResponseInterface
    {
        $db = Database::connect(); $data = $this->request->getJSON(true);
        if (empty($data['url'])||empty($data['name'])) return $this->response->setStatusCode(422)->setJSON(['message'=>'name y url requeridos']);
        $db->table('webhooks')->insert(['project_id'=>$data['project_id']??null,'name'=>$data['name'],'url'=>$data['url'],'secret'=>$data['secret']??null,'events'=>json_encode($data['events']??[]),'is_active'=>1,'created_by'=>Auth::id(),'created_at'=>date('Y-m-d H:i:s')]);
        return $this->response->setStatusCode(201)->setJSON($db->table('webhooks')->where('id',$db->insertID())->get()->getRowArray());
    }
    public function update(int $id): ResponseInterface
    {
        $db = Database::connect(); $data = $this->request->getJSON(true);
        $payload = array_intersect_key($data,array_flip(['name','url','secret','events','is_active']));
        if (isset($payload['events'])) $payload['events'] = json_encode($payload['events']);
        $db->table('webhooks')->where('id',$id)->update($payload);
        return $this->response->setJSON($db->table('webhooks')->where('id',$id)->get()->getRowArray());
    }
    public function delete(int $id): ResponseInterface { Database::connect()->table('webhooks')->where('id',$id)->delete(); return $this->response->setStatusCode(204)->setBody(''); }
    public function test(int $id): ResponseInterface
    {
        $db = Database::connect(); $webhook = $db->table('webhooks')->where('id',$id)->get()->getRowArray();
        if (!$webhook) return $this->response->setStatusCode(404)->setJSON(['message'=>'No encontrado']);
        $payload = json_encode(['event'=>'test','timestamp'=>date('c'),'message'=>'Test webhook from PIAP']);
        $ch = curl_init($webhook['url']);
        curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>$payload,CURLOPT_HTTPHEADER=>['Content-Type: application/json','X-PIAP-Event: test'],CURLOPT_TIMEOUT=>10]);
        curl_exec($ch); $code = curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch);
        $db->table('webhooks')->where('id',$id)->update(['last_sent_at'=>date('Y-m-d H:i:s'),'last_response'=>$code]);
        return $this->response->setJSON(['status'=>$code,'ok'=>$code>=200&&$code<300]);
    }

    /** Fire webhook for a given event (called from other controllers) */
    public static function fire(string $event, array $payload, ?int $projectId = null): void
    {
        try {
            $db = Database::connect();
            $q  = $db->table('webhooks')->where('is_active',1);
            if ($projectId) $q->groupStart()->where('project_id',$projectId)->orWhere('project_id IS NULL')->groupEnd();
            $hooks = $q->get()->getResultArray();
            $body  = json_encode(array_merge(['event'=>$event,'timestamp'=>date('c')],$payload));
            foreach ($hooks as $h) {
                $events = json_decode($h['events']??'[]',true);
                if (!empty($events) && !in_array($event,$events)) continue;
                $ch = curl_init($h['url']);
                $headers = ['Content-Type: application/json','X-PIAP-Event: '.$event];
                if ($h['secret']) $headers[] = 'X-PIAP-Signature: '.hash_hmac('sha256',$body,$h['secret']);
                curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>$body,CURLOPT_HTTPHEADER=>$headers,CURLOPT_TIMEOUT=>5]);
                curl_exec($ch); $code = curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch);
                $db->table('webhooks')->where('id',$h['id'])->update(['last_sent_at'=>date('Y-m-d H:i:s'),'last_response'=>$code]);
            }
        } catch (\Throwable $e) { log_message('error','WebhooksController::fire: '.$e->getMessage()); }
    }
}
