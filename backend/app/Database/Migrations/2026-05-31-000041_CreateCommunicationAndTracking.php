<?php
namespace App\Database\Migrations;
use CodeIgniter\Database\Migration;

/**
 * Feature batch 3 — Announcements, File Annotations, Description History,
 *                   Git Integration, IP Allowlist, Dashboard Widgets, Signatures
 */
class CreateCommunicationAndTracking extends Migration
{
    public function up(): void
    {
        $prefix = $this->db->getPrefix();

        // ── Project announcements ────────────────────────────────────────────
        if (!$this->db->tableExists('project_announcements')) {
            $this->forge->addField([
                'id'          => ['type'=>'INT','unsigned'=>true,'auto_increment'=>true],
                'project_id'  => ['type'=>'INT','unsigned'=>true],
                'author_id'   => ['type'=>'INT','unsigned'=>true,'null'=>true],
                'title'       => ['type'=>'VARCHAR','constraint'=>255],
                'body'        => ['type'=>'LONGTEXT'],
                'pinned'      => ['type'=>'TINYINT','constraint'=>1,'default'=>0],
                'created_at'  => ['type'=>'DATETIME','null'=>true],
                'updated_at'  => ['type'=>'DATETIME','null'=>true],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addForeignKey('project_id','projects','id','CASCADE','CASCADE');
            $this->forge->addForeignKey('author_id', 'users',   'id','SET NULL','CASCADE');
            $this->forge->createTable('project_announcements');
        }

        if (!$this->db->tableExists('announcement_reads')) {
            $this->forge->addField([
                'announcement_id' => ['type'=>'INT','unsigned'=>true],
                'user_id'         => ['type'=>'INT','unsigned'=>true],
                'read_at'         => ['type'=>'DATETIME','null'=>true],
            ]);
            $this->forge->addPrimaryKey(['announcement_id','user_id']);
            $this->forge->addForeignKey('announcement_id','project_announcements','id','CASCADE','CASCADE');
            $this->forge->addForeignKey('user_id',        'users',               'id','CASCADE','CASCADE');
            $this->forge->createTable('announcement_reads');
        }

        // ── File annotations (comments on attachments) ───────────────────────
        if (!$this->db->tableExists('file_annotations')) {
            $this->forge->addField([
                'id'            => ['type'=>'INT','unsigned'=>true,'auto_increment'=>true],
                'attachment_id' => ['type'=>'INT','unsigned'=>true],
                'user_id'       => ['type'=>'INT','unsigned'=>true,'null'=>true],
                'x_pct'         => ['type'=>'DECIMAL','constraint'=>'5,2','default'=>0,'comment'=>'0-100 % from left'],
                'y_pct'         => ['type'=>'DECIMAL','constraint'=>'5,2','default'=>0,'comment'=>'0-100 % from top'],
                'body'          => ['type'=>'TEXT'],
                'resolved'      => ['type'=>'TINYINT','constraint'=>1,'default'=>0],
                'created_at'    => ['type'=>'DATETIME','null'=>true],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addForeignKey('attachment_id','task_attachments','id','CASCADE','CASCADE');
            $this->forge->addForeignKey('user_id',      'users',           'id','SET NULL','CASCADE');
            $this->forge->createTable('file_annotations');
        }

        // ── Task description history ─────────────────────────────────────────
        if (!$this->db->tableExists('task_description_history')) {
            $this->forge->addField([
                'id'          => ['type'=>'INT','unsigned'=>true,'auto_increment'=>true],
                'task_id'     => ['type'=>'INT','unsigned'=>true],
                'description' => ['type'=>'LONGTEXT','null'=>true],
                'changed_by'  => ['type'=>'INT','unsigned'=>true,'null'=>true],
                'created_at'  => ['type'=>'DATETIME','null'=>true],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addKey('task_id');
            $this->forge->addForeignKey('task_id',   'tasks','id','CASCADE','CASCADE');
            $this->forge->addForeignKey('changed_by','users','id','SET NULL','CASCADE');
            $this->forge->createTable('task_description_history');
        }

        // ── Git integrations ─────────────────────────────────────────────────
        if (!$this->db->tableExists('git_integrations')) {
            $this->forge->addField([
                'id'           => ['type'=>'INT','unsigned'=>true,'auto_increment'=>true],
                'project_id'   => ['type'=>'INT','unsigned'=>true'],
                'provider'     => ['type'=>'ENUM','constraint'=>['github','gitlab','bitbucket'],'default'=>'github'],
                'repo_url'     => ['type'=>'VARCHAR','constraint'=>500],
                'webhook_secret'=> ['type'=>'VARCHAR','constraint'=>100,'null'=>true],
                'branch_pattern'=> ['type'=>'VARCHAR','constraint'=>100,'default'=>'*','comment'=>'e.g. main, feature/*'],
                'is_active'    => ['type'=>'TINYINT','constraint'=>1,'default'=>1],
                'created_by'   => ['type'=>'INT','unsigned'=>true,'null'=>true],
                'created_at'   => ['type'=>'DATETIME','null'=>true],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addForeignKey('project_id','projects','id','CASCADE','CASCADE');
            $this->forge->createTable('git_integrations');
        }

        if (!$this->db->tableExists('git_commits')) {
            $this->forge->addField([
                'id'           => ['type'=>'INT','unsigned'=>true,'auto_increment'=>true],
                'task_id'      => ['type'=>'INT','unsigned'=>true,'null'=>true],
                'integration_id'=> ['type'=>'INT','unsigned'=>true],
                'sha'          => ['type'=>'VARCHAR','constraint'=>64],
                'message'      => ['type'=>'VARCHAR','constraint'=>500],
                'author_name'  => ['type'=>'VARCHAR','constraint'=>100,'null'=>true],
                'author_email' => ['type'=>'VARCHAR','constraint'=>150,'null'=>true],
                'url'          => ['type'=>'VARCHAR','constraint'=>500,'null'=>true],
                'committed_at' => ['type'=>'DATETIME','null'=>true],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addForeignKey('task_id',       'tasks',           'id','SET NULL','CASCADE');
            $this->forge->addForeignKey('integration_id','git_integrations','id','CASCADE','CASCADE');
            $this->forge->createTable('git_commits');
        }

        // ── IP allowlist ─────────────────────────────────────────────────────
        if (!$this->db->tableExists('ip_allowlist')) {
            $this->forge->addField([
                'id'         => ['type'=>'INT','unsigned'=>true,'auto_increment'=>true],
                'cidr'       => ['type'=>'VARCHAR','constraint'=>50],
                'label'      => ['type'=>'VARCHAR','constraint'=>100,'null'=>true],
                'is_active'  => ['type'=>'TINYINT','constraint'=>1,'default'=>1],
                'created_by' => ['type'=>'INT','unsigned'=>true,'null'=>true],
                'created_at' => ['type'=>'DATETIME','null'=>true],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->createTable('ip_allowlist');
        }

        // ── Dashboard widget configs ─────────────────────────────────────────
        if (!$this->db->tableExists('dashboard_widgets')) {
            $this->forge->addField([
                'id'         => ['type'=>'INT','unsigned'=>true,'auto_increment'=>true],
                'user_id'    => ['type'=>'INT','unsigned'=>true],
                'widget_type'=> ['type'=>'VARCHAR','constraint'=>60],
                'position'   => ['type'=>'INT UNSIGNED','default'=>0],
                'col_span'   => ['type'=>'TINYINT UNSIGNED','default'=>1],
                'config'     => ['type'=>'JSON','null'=>true],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addForeignKey('user_id','users','id','CASCADE','CASCADE');
            $this->forge->createTable('dashboard_widgets');
        }

        // ── Document digital signatures ──────────────────────────────────────
        if (!$this->db->tableExists('doc_signatures')) {
            $this->forge->addField([
                'id'             => ['type'=>'INT','unsigned'=>true,'auto_increment'=>true],
                'doc_id'         => ['type'=>'INT','unsigned'=>true],
                'user_id'        => ['type'=>'INT','unsigned'=>true,'null'=>true],
                'signer_name'    => ['type'=>'VARCHAR','constraint'=>150],
                'signer_email'   => ['type'=>'VARCHAR','constraint'=>150],
                'signature_hash' => ['type'=>'VARCHAR','constraint'=>64, 'comment'=>'SHA-256 of doc+user+timestamp'],
                'signed_at'      => ['type'=>'DATETIME','null'=>true],
                'ip_address'     => ['type'=>'VARCHAR','constraint'=>45,'null'=>true],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addForeignKey('doc_id', 'project_technical_docs','id','CASCADE','CASCADE');
            $this->forge->addForeignKey('user_id','users',                 'id','SET NULL','CASCADE');
            $this->forge->createTable('doc_signatures');
        }
    }

    public function down(): void
    {
        foreach (['doc_signatures','dashboard_widgets','ip_allowlist','git_commits','git_integrations','task_description_history','file_annotations','announcement_reads','project_announcements'] as $t) {
            $this->forge->dropTable($t, true);
        }
    }
}
