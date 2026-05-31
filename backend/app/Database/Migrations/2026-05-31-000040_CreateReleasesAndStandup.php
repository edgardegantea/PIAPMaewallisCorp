<?php
namespace App\Database\Migrations;
use CodeIgniter\Database\Migration;

/**
 * Feature batch 2 — Releases, Changelogs, Standup, Weekly Reports, SLA
 */
class CreateReleasesAndStandup extends Migration
{
    public function up(): void
    {
        // ── Releases / Versions ──────────────────────────────────────────────
        if (!$this->db->tableExists('releases')) {
            $this->forge->addField([
                'id'           => ['type'=>'INT','unsigned'=>true,'auto_increment'=>true],
                'project_id'   => ['type'=>'INT','unsigned'=>true],
                'name'         => ['type'=>'VARCHAR','constraint'=>100],
                'version'      => ['type'=>'VARCHAR','constraint'=>30],
                'status'       => ['type'=>'ENUM','constraint'=>['PLANNED','IN_PROGRESS','RELEASED','CANCELLED'],'default'=>'PLANNED'],
                'release_date' => ['type'=>'DATE','null'=>true],
                'description'  => ['type'=>'TEXT','null'=>true],
                'changelog'    => ['type'=>'LONGTEXT','null'=>true, 'comment'=>'Auto-generated from completed tasks'],
                'created_by'   => ['type'=>'INT','unsigned'=>true,'null'=>true],
                'created_at'   => ['type'=>'DATETIME','null'=>true],
                'updated_at'   => ['type'=>'DATETIME','null'=>true],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addForeignKey('project_id','projects','id','CASCADE','CASCADE');
            $this->forge->addForeignKey('created_by','users',   'id','SET NULL','CASCADE');
            $this->forge->createTable('releases');
        }

        if (!$this->db->tableExists('release_tasks')) {
            $this->forge->addField([
                'release_id' => ['type'=>'INT','unsigned'=>true],
                'task_id'    => ['type'=>'INT','unsigned'=>true],
            ]);
            $this->forge->addPrimaryKey(['release_id','task_id']);
            $this->forge->addForeignKey('release_id','releases','id','CASCADE','CASCADE');
            $this->forge->addForeignKey('task_id',   'tasks',   'id','CASCADE','CASCADE');
            $this->forge->createTable('release_tasks');
        }

        // ── Daily standup ────────────────────────────────────────────────────
        if (!$this->db->tableExists('standup_questions')) {
            $this->forge->addField([
                'id'          => ['type'=>'INT','unsigned'=>true,'auto_increment'=>true],
                'project_id'  => ['type'=>'INT','unsigned'=>true],
                'question'    => ['type'=>'VARCHAR','constraint'=>255],
                'schedule'    => ['type'=>'ENUM','constraint'=>['daily','weekly'],'default'=>'daily'],
                'day_of_week' => ['type'=>'TINYINT','null'=>true,'comment'=>'0=Sun,1=Mon... for weekly'],
                'is_active'   => ['type'=>'TINYINT','constraint'=>1,'default'=>1],
                'created_at'  => ['type'=>'DATETIME','null'=>true],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addForeignKey('project_id','projects','id','CASCADE','CASCADE');
            $this->forge->createTable('standup_questions');
        }

        if (!$this->db->tableExists('standup_answers')) {
            $this->forge->addField([
                'id'          => ['type'=>'INT','unsigned'=>true,'auto_increment'=>true],
                'question_id' => ['type'=>'INT','unsigned'=>true],
                'user_id'     => ['type'=>'INT','unsigned'=>true,'null'=>true],
                'answer'      => ['type'=>'TEXT'],
                'answer_date' => ['type'=>'DATE'],
                'created_at'  => ['type'=>'DATETIME','null'=>true],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addKey(['question_id','user_id','answer_date'], false, true); // unique per user per question per day
            $this->forge->addForeignKey('question_id','standup_questions','id','CASCADE','CASCADE');
            $this->forge->addForeignKey('user_id',    'users',            'id','SET NULL','CASCADE');
            $this->forge->createTable('standup_answers');
        }

        // ── Weekly status report ─────────────────────────────────────────────
        if (!$this->db->tableExists('weekly_reports')) {
            $this->forge->addField([
                'id'          => ['type'=>'INT','unsigned'=>true,'auto_increment'=>true],
                'project_id'  => ['type'=>'INT','unsigned'=>true],
                'author_id'   => ['type'=>'INT','unsigned'=>true,'null'=>true],
                'week_start'  => ['type'=>'DATE'],
                'rag'         => ['type'=>'ENUM','constraint'=>['GREEN','AMBER','RED'],'default'=>'GREEN'],
                'highlights'  => ['type'=>'TEXT','null'=>true],
                'blockers'    => ['type'=>'TEXT','null'=>true],
                'next_steps'  => ['type'=>'TEXT','null'=>true],
                'metrics_snapshot' => ['type'=>'JSON','null'=>true],
                'created_at'  => ['type'=>'DATETIME','null'=>true],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addForeignKey('project_id','projects','id','CASCADE','CASCADE');
            $this->forge->addForeignKey('author_id', 'users',   'id','SET NULL','CASCADE');
            $this->forge->createTable('weekly_reports');
        }

        // ── SLA policies ─────────────────────────────────────────────────────
        if (!$this->db->tableExists('sla_policies')) {
            $this->forge->addField([
                'id'               => ['type'=>'INT','unsigned'=>true,'auto_increment'=>true],
                'project_id'       => ['type'=>'INT','unsigned'=>true,'null'=>true],
                'name'             => ['type'=>'VARCHAR','constraint'=>100],
                'applies_to'       => ['type'=>'ENUM','constraint'=>['CRITICA','ALTA','MEDIA','BAJA','ALL'],'default'=>'ALL'],
                'response_hours'   => ['type'=>'INT UNSIGNED','default'=>4],
                'resolution_hours' => ['type'=>'INT UNSIGNED','default'=>24],
                'is_active'        => ['type'=>'TINYINT','constraint'=>1,'default'=>1],
                'created_at'       => ['type'=>'DATETIME','null'=>true],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addForeignKey('project_id','projects','id','SET NULL','CASCADE');
            $this->forge->createTable('sla_policies');
        }

        if (!$this->db->tableExists('task_sla')) {
            $this->forge->addField([
                'task_id'              => ['type'=>'INT','unsigned'=>true],
                'policy_id'            => ['type'=>'INT','unsigned'=>true],
                'response_deadline'    => ['type'=>'DATETIME','null'=>true],
                'resolution_deadline'  => ['type'=>'DATETIME','null'=>true],
                'first_response_at'    => ['type'=>'DATETIME','null'=>true],
                'resolved_at'          => ['type'=>'DATETIME','null'=>true],
                'response_breached'    => ['type'=>'TINYINT','constraint'=>1,'default'=>0],
                'resolution_breached'  => ['type'=>'TINYINT','constraint'=>1,'default'=>0],
            ]);
            $this->forge->addPrimaryKey(['task_id','policy_id']);
            $this->forge->addForeignKey('task_id',  'tasks',       'id','CASCADE','CASCADE');
            $this->forge->addForeignKey('policy_id','sla_policies','id','CASCADE','CASCADE');
            $this->forge->createTable('task_sla');
        }
    }

    public function down(): void
    {
        foreach (['task_sla','sla_policies','weekly_reports','standup_answers','standup_questions','release_tasks','releases'] as $t) {
            $this->forge->dropTable($t, true);
        }
    }
}
