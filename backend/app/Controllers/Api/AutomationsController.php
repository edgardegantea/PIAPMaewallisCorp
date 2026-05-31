<?php
namespace App\Controllers\Api;
use App\Controllers\BaseController;
use App\Libraries\Auth;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

/**
 * Automation Rules — if/then engine.
 *
 * GET    /api/projects/:id/automations
 * POST   /api/projects/:id/automations  { name, trigger_event, conditions[], actions[] }
 * PATCH  /api/automations/:id
 * DELETE /api/automations/:id
 * POST   /api/automations/:id/toggle
 * GET    /api/automations/:id/logs
 *
 * Static fire() called from TasksController on status change, creation, etc.
 */
class AutomationsController extends BaseController
{
    /** Available trigger events */
    public const TRIGGERS = [
        'task.created', 'task.status_changed', 'task.assigned',
        'task.due_date.passed', 'task.completed',
        'sprint.started', 'sprint.completed',
        'risk.created', 'member.added',
    ];

    /** Available action types */
    public const ACTIONS = [
        'set_status', 'set_assignee', 'set_priority', 'set_label',
        'move_to_sprint', 'add_comment', 'send_notification', 'trigger_webhook',
    ];

    public function index(int $projectId): ResponseInterface
    {
        $db = Database::connect();
        return $this->response->setJSON($db->query("
            SELECT a.*, CONCAT(u.first_name,' ',u.last_name) AS created_by_name
            FROM automation_rules a LEFT JOIN users u ON u.id = a.created_by
            WHERE a.project_id = ? OR a.project_id IS NULL
            ORDER BY a.created_at DESC
        ", [$projectId])->getResultArray());
    }

    public function create(int $projectId): ResponseInterface
    {
        $db   = Database::connect();
        $data = $this->request->getJSON(true);
        if (empty($data['name']) || empty($data['trigger_event']) || empty($data['actions'])) {
            return $this->response->setStatusCode(422)->setJSON(['message' => 'name, trigger_event y actions requeridos']);
        }
        $db->table('automation_rules')->insert([
            'project_id'    => $projectId,
            'name'          => $data['name'],
            'trigger_event' => $data['trigger_event'],
            'conditions'    => isset($data['conditions']) ? json_encode($data['conditions']) : null,
            'actions'       => json_encode($data['actions']),
            'is_active'     => 1,
            'created_by'    => Auth::id(),
            'created_at'    => date('Y-m-d H:i:s'),
        ]);
        return $this->response->setStatusCode(201)->setJSON(
            $db->table('automation_rules')->where('id', $db->insertID())->get()->getRowArray()
        );
    }

    public function update(int $id): ResponseInterface
    {
        $db   = Database::connect();
        $data = $this->request->getJSON(true);
        $allowed = ['name','trigger_event','conditions','actions','is_active'];
        $payload = array_intersect_key($data, array_flip($allowed));
        foreach (['conditions','actions'] as $k) { if (isset($payload[$k]) && is_array($payload[$k])) $payload[$k] = json_encode($payload[$k]); }
        $db->table('automation_rules')->where('id', $id)->update($payload);
        return $this->response->setJSON($db->table('automation_rules')->where('id', $id)->get()->getRowArray());
    }

    public function delete(int $id): ResponseInterface
    {
        Database::connect()->table('automation_rules')->where('id', $id)->delete();
        return $this->response->setStatusCode(204)->setBody('');
    }

    public function toggle(int $id): ResponseInterface
    {
        $db   = Database::connect();
        $rule = $db->table('automation_rules')->where('id', $id)->get()->getRowArray();
        if (!$rule) return $this->response->setStatusCode(404)->setJSON(['message' => 'No encontrada']);
        $new = $rule['is_active'] ? 0 : 1;
        $db->table('automation_rules')->where('id', $id)->update(['is_active' => $new]);
        return $this->response->setJSON(['is_active' => $new]);
    }

    public function logs(int $id): ResponseInterface
    {
        $db = Database::connect();
        return $this->response->setJSON($db->table('automation_logs')->where('rule_id', $id)->orderBy('created_at','DESC')->limit(50)->get()->getResultArray());
    }

    public function getMetadata(): ResponseInterface
    {
        return $this->response->setJSON(['triggers' => self::TRIGGERS, 'actions' => self::ACTIONS]);
    }

    /**
     * Fire automation rules for a given event.
     * Called statically from other controllers (TasksController, etc.)
     */
    public static function fire(string $event, array $context, ?int $projectId = null): void
    {
        try {
            $db    = Database::connect();
            $rules = $db->query("
                SELECT * FROM automation_rules
                WHERE trigger_event = ? AND is_active = 1
                  AND (project_id = ? OR project_id IS NULL)
            ", [$event, $projectId])->getResultArray();

            foreach ($rules as $rule) {
                try {
                    $conditions = json_decode($rule['conditions'] ?? '[]', true) ?: [];
                    if (!self::checkConditions($conditions, $context)) continue;

                    $actions = json_decode($rule['actions'], true) ?: [];
                    foreach ($actions as $action) {
                        self::executeAction($action, $context, $db);
                    }

                    $db->table('automation_rules')->where('id', $rule['id'])->update(['run_count' => $db->query("SELECT run_count FROM automation_rules WHERE id = ?", [$rule['id']])->getRowArray()['run_count'] + 1, 'last_run_at' => date('Y-m-d H:i:s')]);
                    $db->table('automation_logs')->insert(['rule_id'=>$rule['id'],'entity_type'=>$context['entity_type']??'task','entity_id'=>$context['entity_id']??0,'result'=>'ok','created_at'=>date('Y-m-d H:i:s')]);
                } catch (\Throwable $e) {
                    $db->table('automation_logs')->insert(['rule_id'=>$rule['id'],'entity_type'=>$context['entity_type']??'task','entity_id'=>$context['entity_id']??0,'result'=>'error','detail'=>$e->getMessage(),'created_at'=>date('Y-m-d H:i:s')]);
                }
            }
        } catch (\Throwable $e) {
            log_message('error', 'AutomationsController::fire: ' . $e->getMessage());
        }
    }

    private static function checkConditions(array $conditions, array $ctx): bool
    {
        foreach ($conditions as $cond) {
            $field = $cond['field'] ?? '';
            $op    = $cond['op']    ?? 'eq';
            $val   = $cond['value'] ?? '';
            $ctxVal = $ctx[$field] ?? null;
            $pass = match($op) {
                'eq'       => $ctxVal == $val,
                'neq'      => $ctxVal != $val,
                'contains' => str_contains((string)$ctxVal, (string)$val),
                'gt'       => (float)$ctxVal > (float)$val,
                'lt'       => (float)$ctxVal < (float)$val,
                default    => true,
            };
            if (!$pass) return false;
        }
        return true;
    }

    private static function executeAction(array $action, array $ctx, $db): void
    {
        $type   = $action['type']  ?? '';
        $value  = $action['value'] ?? null;
        $taskId = $ctx['entity_id'] ?? null;

        match($type) {
            'set_status'   => $taskId && $db->table('tasks')->where('id',$taskId)->update(['status'=>$value,'updated_at'=>date('Y-m-d H:i:s')]),
            'set_assignee' => $taskId && $db->table('tasks')->where('id',$taskId)->update(['assigned_to'=>(int)$value,'updated_at'=>date('Y-m-d H:i:s')]),
            'set_priority' => $taskId && $db->table('tasks')->where('id',$taskId)->update(['priority'=>$value,'updated_at'=>date('Y-m-d H:i:s')]),
            'add_comment'  => $taskId && $db->table('task_comments')->insert(['task_id'=>$taskId,'user_id'=>null,'body'=>'🤖 Automatización: '.$value,'created_at'=>date('Y-m-d H:i:s')]),
            default        => null,
        };
    }
}
