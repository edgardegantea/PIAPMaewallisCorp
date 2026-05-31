<?php
namespace App\Database\Migrations;
use CodeIgniter\Database\Migration;

/**
 * Feature batch 1 of 3 — Automations, Custom Fields, Statuses, Filters, RICE
 */
class CreateAutomationsAndCustomFields extends Migration
{
    public function up(): void
    {
        $prefix = $this->db->getPrefix();

        // ── Automation rules ─────────────────────────────────────────────────
        if (!$this->db->tableExists('automation_rules')) {
            $this->forge->addField([
                'id'            => ['type'=>'INT','unsigned'=>true,'auto_increment'=>true],
                'project_id'    => ['type'=>'INT','unsigned'=>true,'null'=>true],
                'name'          => ['type'=>'VARCHAR','constraint'=>150],
                'trigger_event' => ['type'=>'VARCHAR','constraint'=>60,  'comment'=>'task.created|task.status_changed|sprint.started|due_date.passed|...'],
                'conditions'    => ['type'=>'JSON','null'=>true],
                'actions'       => ['type'=>'JSON','null'=>false],
                'is_active'     => ['type'=>'TINYINT','constraint'=>1,'default'=>1],
                'run_count'     => ['type'=>'INT UNSIGNED','default'=>0],
                'last_run_at'   => ['type'=>'DATETIME','null'=>true],
                'created_by'    => ['type'=>'INT','unsigned'=>true,'null'=>true],
                'created_at'    => ['type'=>'DATETIME','null'=>true],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addForeignKey('project_id','projects','id','SET NULL','CASCADE');
            $this->forge->addForeignKey('created_by','users',   'id','SET NULL','CASCADE');
            $this->forge->createTable('automation_rules');
        }

        if (!$this->db->tableExists('automation_logs')) {
            $this->forge->addField([
                'id'         => ['type'=>'INT','unsigned'=>true,'auto_increment'=>true],
                'rule_id'    => ['type'=>'INT','unsigned'=>true],
                'entity_type'=> ['type'=>'VARCHAR','constraint'=>40],
                'entity_id'  => ['type'=>'INT','unsigned'=>true],
                'result'     => ['type'=>'ENUM','constraint'=>['ok','error'],'default'=>'ok'],
                'detail'     => ['type'=>'TEXT','null'=>true],
                'created_at' => ['type'=>'DATETIME','null'=>true],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addForeignKey('rule_id','automation_rules','id','CASCADE','CASCADE');
            $this->forge->createTable('automation_logs');
        }

        // ── Custom fields ────────────────────────────────────────────────────
        if (!$this->db->tableExists('custom_fields')) {
            $this->forge->addField([
                'id'          => ['type'=>'INT','unsigned'=>true,'auto_increment'=>true],
                'project_id'  => ['type'=>'INT','unsigned'=>true,'null'=>true],
                'name'        => ['type'=>'VARCHAR','constraint'=>100],
                'field_key'   => ['type'=>'VARCHAR','constraint'=>60],
                'field_type'  => ['type'=>'ENUM','constraint'=>['text','number','date','dropdown','user','url','checkbox'],'default'=>'text'],
                'options'     => ['type'=>'JSON','null'=>true, 'comment'=>'For dropdown: ["opt1","opt2"]'],
                'is_required' => ['type'=>'TINYINT','constraint'=>1,'default'=>0],
                'sort_order'  => ['type'=>'INT UNSIGNED','default'=>0],
                'created_at'  => ['type'=>'DATETIME','null'=>true],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addForeignKey('project_id','projects','id','CASCADE','CASCADE');
            $this->forge->createTable('custom_fields');
        }

        if (!$this->db->tableExists('task_custom_values')) {
            $this->forge->addField([
                'task_id'  => ['type'=>'INT','unsigned'=>true],
                'field_id' => ['type'=>'INT','unsigned'=>true],
                'value'    => ['type'=>'TEXT','null'=>true],
            ]);
            $this->forge->addPrimaryKey(['task_id','field_id']);
            $this->forge->addForeignKey('task_id', 'tasks',         'id','CASCADE','CASCADE');
            $this->forge->addForeignKey('field_id','custom_fields', 'id','CASCADE','CASCADE');
            $this->forge->createTable('task_custom_values');
        }

        // ── Custom project statuses ──────────────────────────────────────────
        if (!$this->db->tableExists('project_statuses')) {
            $this->forge->addField([
                'id'         => ['type'=>'INT','unsigned'=>true,'auto_increment'=>true],
                'project_id' => ['type'=>'INT','unsigned'=>true],
                'name'       => ['type'=>'VARCHAR','constraint'=>60],
                'color'      => ['type'=>'VARCHAR','constraint'=>7,'default'=>'#6366f1'],
                'position'   => ['type'=>'INT UNSIGNED','default'=>0],
                'is_default' => ['type'=>'TINYINT','constraint'=>1,'default'=>0],
                'maps_to'    => ['type'=>'ENUM','constraint'=>['PENDIENTE','EN_PROGRESO','BLOQUEADA','COMPLETADA'],'default'=>'PENDIENTE','comment'=>'Maps to system status'],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addForeignKey('project_id','projects','id','CASCADE','CASCADE');
            $this->forge->createTable('project_statuses');
        }

        // ── Saved filters ────────────────────────────────────────────────────
        if (!$this->db->tableExists('saved_filters')) {
            $this->forge->addField([
                'id'         => ['type'=>'INT','unsigned'=>true,'auto_increment'=>true],
                'user_id'    => ['type'=>'INT','unsigned'=>true],
                'project_id' => ['type'=>'INT','unsigned'=>true,'null'=>true],
                'name'       => ['type'=>'VARCHAR','constraint'=>100],
                'filters'    => ['type'=>'JSON'],
                'created_at' => ['type'=>'DATETIME','null'=>true],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addForeignKey('user_id',   'users',   'id','CASCADE','CASCADE');
            $this->forge->addForeignKey('project_id','projects','id','CASCADE','CASCADE');
            $this->forge->createTable('saved_filters');
        }

        // ── RICE scoring ─────────────────────────────────────────────────────
        if (!$this->db->fieldExists('rice_reach', 'tasks')) {
            $this->db->query("ALTER TABLE `{$prefix}tasks`
                ADD COLUMN `rice_reach`      TINYINT UNSIGNED NULL AFTER `story_points`,
                ADD COLUMN `rice_impact`     TINYINT UNSIGNED NULL AFTER `rice_reach`,
                ADD COLUMN `rice_confidence` TINYINT UNSIGNED NULL AFTER `rice_impact`,
                ADD COLUMN `rice_effort`     TINYINT UNSIGNED NULL AFTER `rice_confidence`,
                ADD COLUMN `rice_score`      DECIMAL(8,2)     NULL AFTER `rice_effort`");
        }
    }

    public function down(): void
    {
        foreach (['automation_logs','automation_rules','task_custom_values','custom_fields','project_statuses','saved_filters'] as $t) {
            $this->forge->dropTable($t, true);
        }
    }
}
