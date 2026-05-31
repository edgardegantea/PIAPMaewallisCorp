<?php
namespace App\Controllers\Api;
use App\Controllers\BaseController;
use App\Libraries\Auth;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

/**
 * Bulk import: CSV tasks + Jira JSON export.
 *
 * POST /api/projects/:id/import/csv    multipart: file (CSV), sprint_id
 * POST /api/projects/:id/import/jira  multipart: file (JSON Jira export), sprint_id
 */
class ImportController extends BaseController
{
    public function csv(int $projectId): ResponseInterface
    {
        $file = $this->request->getFile('file');
        if (!$file||!$file->isValid()) return $this->response->setStatusCode(422)->setJSON(['message'=>'Archivo CSV requerido']);
        $sprintId = (int)$this->request->getPost('sprint_id');
        if (!$sprintId) return $this->response->setStatusCode(422)->setJSON(['message'=>'sprint_id requerido']);

        $content = file_get_contents($file->getTempName());
        $lines   = array_filter(array_map('str_getcsv',explode("\n",$content)));
        $headers = array_map('strtolower',array_map('trim',array_shift($lines)));

        $db      = Database::connect();
        $created = 0; $errors = [];

        foreach ($lines as $i => $cols) {
            if (count($cols) < 1) continue;
            $row = array_combine(array_slice($headers,0,count($cols)),array_slice($cols,0,count($headers)));
            $title = trim($row['title']??$row['titulo']??$row['name']??'');
            if (!$title) { $errors[] = "Fila ".($i+2).": sin título"; continue; }

            $priority = strtoupper($row['priority']??$row['prioridad']??'MEDIA');
            if (!in_array($priority,['BAJA','MEDIA','ALTA','CRITICA'])) $priority='MEDIA';

            $status = strtoupper($row['status']??$row['estado']??'PENDIENTE');
            if (!in_array($status,['PENDIENTE','EN_PROGRESO','BLOQUEADA','COMPLETADA'])) $status='PENDIENTE';

            $db->table('tasks')->insert(['sprint_id'=>$sprintId,'title'=>$title,'priority'=>$priority,'status'=>$status,'description'=>$row['description']??$row['descripcion']??null,'estimated_hours'=>(int)($row['estimated_hours']??$row['horas_estimadas']??0),'story_points'=>isset($row['story_points'])?(int)$row['story_points']:null,'created_at'=>date('Y-m-d H:i:s'),'updated_at'=>date('Y-m-d H:i:s')]);
            $created++;
        }

        return $this->response->setJSON(['created'=>$created,'errors'=>$errors,'message'=>"$created tarea(s) importada(s)"]);
    }

    public function jira(int $projectId): ResponseInterface
    {
        $file = $this->request->getFile('file');
        if (!$file||!$file->isValid()) return $this->response->setStatusCode(422)->setJSON(['message'=>'Archivo JSON de Jira requerido']);
        $sprintId = (int)$this->request->getPost('sprint_id');
        if (!$sprintId) return $this->response->setStatusCode(422)->setJSON(['message'=>'sprint_id requerido']);

        $content = file_get_contents($file->getTempName());
        $data    = json_decode($content,true);
        if (!$data) return $this->response->setStatusCode(422)->setJSON(['message'=>'JSON inválido']);

        // Jira export format: { "issues": [ { "key":"PRJ-1","fields":{ "summary":"...", "priority":{"name":"..."}, "status":{"name":"..."} } } ] }
        $issues  = $data['issues'] ?? (isset($data[0]['key']) ? $data : []);
        $db      = Database::connect();
        $created = 0; $errors = [];

        $priorityMap = ['Highest'=>'CRITICA','High'=>'ALTA','Medium'=>'MEDIA','Low'=>'BAJA','Lowest'=>'BAJA'];
        $statusMap   = ['To Do'=>'PENDIENTE','In Progress'=>'EN_PROGRESO','Done'=>'COMPLETADA','Blocked'=>'BLOQUEADA'];

        foreach ($issues as $issue) {
            $fields  = $issue['fields'] ?? $issue;
            $title   = trim($fields['summary'] ?? $issue['key'] ?? '');
            if (!$title) { $errors[] = "Issue sin summary"; continue; }
            $jiraPrio = $fields['priority']['name'] ?? 'Medium';
            $jiraStat = $fields['status']['name']   ?? 'To Do';
            $db->table('tasks')->insert(['sprint_id'=>$sprintId,'title'=>$title,'priority'=>$priorityMap[$jiraPrio]??'MEDIA','status'=>$statusMap[$jiraStat]??'PENDIENTE','description'=>strip_tags($fields['description']??''),'estimated_hours'=>(int)(($fields['timeoriginalestimate']??0)/3600),'created_at'=>date('Y-m-d H:i:s'),'updated_at'=>date('Y-m-d H:i:s')]);
            $created++;
        }

        return $this->response->setJSON(['created'=>$created,'errors'=>$errors,'message'=>"$created issue(s) de Jira importado(s)"]);
    }
}
