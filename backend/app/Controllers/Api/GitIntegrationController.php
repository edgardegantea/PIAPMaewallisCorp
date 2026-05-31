<?php
namespace App\Controllers\Api;
use App\Controllers\BaseController;
use App\Libraries\Auth;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

class GitIntegrationController extends BaseController
{
    public function index(int $projectId): ResponseInterface
    {
        return $this->response->setJSON(Database::connect()->table('git_integrations')->where('project_id',$projectId)->get()->getResultArray());
    }
    public function create(int $projectId): ResponseInterface
    {
        $db = Database::connect(); $data = $this->request->getJSON(true);
        if (empty($data['repo_url'])) return $this->response->setStatusCode(422)->setJSON(['message'=>'repo_url requerida']);
        $secret = bin2hex(random_bytes(16));
        $db->table('git_integrations')->insert(['project_id'=>$projectId,'provider'=>$data['provider']??'github','repo_url'=>$data['repo_url'],'webhook_secret'=>$secret,'branch_pattern'=>$data['branch_pattern']??'*','is_active'=>1,'created_by'=>Auth::id(),'created_at'=>date('Y-m-d H:i:s')]);
        $id = $db->insertID();
        $row = $db->table('git_integrations')->where('id',$id)->get()->getRowArray();
        $row['webhook_url'] = rtrim(env('APP_BACKEND_URL','https://piap-backend.maewalliscorp.org/api'),'/')."/git-webhook/{$id}";
        return $this->response->setStatusCode(201)->setJSON($row);
    }
    public function delete(int $id): ResponseInterface { Database::connect()->table('git_integrations')->where('id',$id)->delete(); return $this->response->setStatusCode(204)->setBody(''); }

    public function commits(int $projectId): ResponseInterface
    {
        return $this->response->setJSON(Database::connect()->query("
            SELECT gc.*,t.title AS task_title,gi.provider,gi.repo_url
            FROM git_commits gc
            JOIN git_integrations gi ON gi.id=gc.integration_id
            LEFT JOIN tasks t ON t.id=gc.task_id
            WHERE gi.project_id=? ORDER BY gc.committed_at DESC LIMIT 50
        ",[$projectId])->getResultArray());
    }

    /** POST /api/git-webhook/:integrationId — receives GitHub/GitLab push events */
    public function webhook(int $integrationId): ResponseInterface
    {
        $db = Database::connect();
        $integration = $db->table('git_integrations')->where('id',$integrationId)->where('is_active',1)->get()->getRowArray();
        if (!$integration) return $this->response->setStatusCode(404)->setJSON(['message'=>'Integration not found']);

        // Verify signature if secret is set
        if ($integration['webhook_secret']) {
            $sig  = $this->request->getHeaderLine('X-Hub-Signature-256');
            $body = $this->request->getBody();
            $expected = 'sha256='.hash_hmac('sha256',$body,$integration['webhook_secret']);
            if ($sig && !hash_equals($expected,$sig)) return $this->response->setStatusCode(401)->setJSON(['message'=>'Invalid signature']);
        }

        $payload = $this->request->getJSON(true);
        $commits  = $payload['commits'] ?? [];
        $created  = 0;

        foreach ($commits as $commit) {
            $message = $commit['message'] ?? '';
            $taskId  = null;
            // Extract task references: #123 or PROJ-123
            if (preg_match('/#(\d+)/', $message, $m)) {
                $task = $db->table('tasks t')->join('sprints s','s.id=t.sprint_id')->where('t.id',(int)$m[1])->where('s.project_id',$integration['project_id'])->get()->getRowArray();
                if ($task) {
                    $taskId = $task['id'];
                    // Auto-move to EN_PROGRESO if referenced in commit and still PENDIENTE
                    if ($task['status'] === 'PENDIENTE') {
                        $db->table('tasks')->where('id',$taskId)->update(['status'=>'EN_PROGRESO','updated_at'=>date('Y-m-d H:i:s')]);
                    }
                }
            }
            $db->table('git_commits')->insert(['task_id'=>$taskId,'integration_id'=>$integrationId,'sha'=>substr($commit['id']??'',0,40),'message'=>substr($message,0,500),'author_name'=>$commit['author']['name']??null,'author_email'=>$commit['author']['email']??null,'url'=>$commit['url']??null,'committed_at'=>$commit['timestamp']??date('Y-m-d H:i:s')]);
            $created++;
        }
        return $this->response->setJSON(['received'=>$created]);
    }
}
