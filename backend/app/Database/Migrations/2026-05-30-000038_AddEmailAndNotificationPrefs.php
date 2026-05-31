<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * - email_notifications preference per user
 * - notification_preferences JSON column
 * - reminder_at on tasks (for reminders feature)
 * - recurrence fields on tasks
 * - task_labels + task_label_pivot tables
 * - task_templates table
 * - planning_poker tables
 * - sprint_budget column on sprints
 * - user_sessions table (session history)
 * - totp_secret on users (2FA)
 */
class AddEmailAndNotificationPrefs extends Migration
{
    public function up(): void
    {
        $prefix = $this->db->getPrefix();

        // Users: notification preferences + 2FA secret
        foreach ([
            'email_notifications'    => "TINYINT(1) NOT NULL DEFAULT 1 AFTER `is_active`",
            'notification_prefs'     => "JSON NULL AFTER `email_notifications`",
            'totp_secret'            => "VARCHAR(64) NULL AFTER `notification_prefs`",
            'totp_enabled'           => "TINYINT(1) NOT NULL DEFAULT 0 AFTER `totp_secret`",
        ] as $col => $def) {
            if (!$this->db->fieldExists($col, 'users')) {
                $this->db->query("ALTER TABLE `{$prefix}users` ADD COLUMN `{$col}` {$def}");
            }
        }

        // Tasks: reminder + recurrence
        foreach ([
            'reminder_at'        => "DATETIME NULL AFTER `due_time`",
            'reminder_sent'      => "TINYINT(1) NOT NULL DEFAULT 0 AFTER `reminder_at`",
            'recurrence_rule'    => "VARCHAR(50) NULL AFTER `reminder_sent`",
            'recurrence_end'     => "DATE NULL AFTER `recurrence_rule`",
            'recurrence_parent'  => "INT UNSIGNED NULL AFTER `recurrence_end`",
        ] as $col => $def) {
            if (!$this->db->fieldExists($col, 'tasks')) {
                $this->db->query("ALTER TABLE `{$prefix}tasks` ADD COLUMN `{$col}` {$def}");
            }
        }

        // Sprints: budget
        if (!$this->db->fieldExists('budget', 'sprints')) {
            $this->db->query("ALTER TABLE `{$prefix}sprints` ADD COLUMN `budget` DECIMAL(15,2) NULL AFTER `status`");
        }

        // Task labels
        if (!$this->db->tableExists('task_labels')) {
            $this->forge->addField([
                'id'         => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
                'project_id' => ['type' => 'INT', 'unsigned' => true, 'null' => true],
                'name'       => ['type' => 'VARCHAR', 'constraint' => 60],
                'color'      => ['type' => 'VARCHAR', 'constraint' => 7, 'default' => '#6366f1'],
                'created_by' => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addForeignKey('project_id', 'projects', 'id', 'CASCADE',  'CASCADE');
            $this->forge->addForeignKey('created_by', 'users',    'id', 'SET NULL', 'CASCADE');
            $this->forge->createTable('task_labels');
        }

        if (!$this->db->tableExists('task_label_pivot')) {
            $this->forge->addField([
                'task_id'  => ['type' => 'INT', 'unsigned' => true],
                'label_id' => ['type' => 'INT', 'unsigned' => true],
            ]);
            $this->forge->addPrimaryKey(['task_id', 'label_id']);
            $this->forge->addForeignKey('task_id',  'tasks',       'id', 'CASCADE', 'CASCADE');
            $this->forge->addForeignKey('label_id', 'task_labels', 'id', 'CASCADE', 'CASCADE');
            $this->forge->createTable('task_label_pivot');
        }

        // Task templates
        if (!$this->db->tableExists('task_templates')) {
            $this->forge->addField([
                'id'          => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
                'project_id'  => ['type' => 'INT', 'unsigned' => true, 'null' => true],
                'name'        => ['type' => 'VARCHAR', 'constraint' => 150],
                'title'       => ['type' => 'VARCHAR', 'constraint' => 255],
                'description' => ['type' => 'TEXT', 'null' => true],
                'priority'    => ['type' => 'ENUM', 'constraint' => ['BAJA','MEDIA','ALTA','CRITICA'], 'default' => 'MEDIA'],
                'estimated_hours' => ['type' => 'INT UNSIGNED', 'default' => 0],
                'story_points'    => ['type' => 'TINYINT UNSIGNED', 'null' => true],
                'checklist'   => ['type' => 'JSON', 'null' => true],
                'created_by'  => ['type' => 'INT', 'unsigned' => true, 'null' => true],
                'created_at'  => ['type' => 'DATETIME', 'null' => true],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addForeignKey('project_id', 'projects', 'id', 'SET NULL', 'CASCADE');
            $this->forge->addForeignKey('created_by', 'users',    'id', 'SET NULL', 'CASCADE');
            $this->forge->createTable('task_templates');
        }

        // Planning Poker
        if (!$this->db->tableExists('poker_sessions')) {
            $this->forge->addField([
                'id'          => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
                'project_id'  => ['type' => 'INT', 'unsigned' => true],
                'task_id'     => ['type' => 'INT', 'unsigned' => true, 'null' => true],
                'status'      => ['type' => 'ENUM', 'constraint' => ['VOTING','REVEALED','CLOSED'], 'default' => 'VOTING'],
                'created_by'  => ['type' => 'INT', 'unsigned' => true, 'null' => true],
                'created_at'  => ['type' => 'DATETIME', 'null' => true],
                'revealed_at' => ['type' => 'DATETIME', 'null' => true],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addForeignKey('project_id', 'projects', 'id', 'CASCADE', 'CASCADE');
            $this->forge->createTable('poker_sessions');
        }

        if (!$this->db->tableExists('poker_votes')) {
            $this->forge->addField([
                'id'         => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
                'session_id' => ['type' => 'INT', 'unsigned' => true],
                'user_id'    => ['type' => 'INT', 'unsigned' => true, 'null' => true],
                'vote'       => ['type' => 'VARCHAR', 'constraint' => 10, 'null' => true],
                'voted_at'   => ['type' => 'DATETIME', 'null' => true],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addUniqueKey(['session_id', 'user_id']);
            $this->forge->addForeignKey('session_id', 'poker_sessions', 'id', 'CASCADE', 'CASCADE');
            $this->forge->createTable('poker_votes');
        }

        // User sessions (session history)
        if (!$this->db->tableExists('user_sessions')) {
            $this->forge->addField([
                'id'          => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
                'user_id'     => ['type' => 'INT', 'unsigned' => true],
                'token_hash'  => ['type' => 'VARCHAR', 'constraint' => 64, 'null' => true],
                'ip_address'  => ['type' => 'VARCHAR', 'constraint' => 45, 'null' => true],
                'user_agent'  => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
                'device'      => ['type' => 'VARCHAR', 'constraint' => 100, 'null' => true],
                'last_active' => ['type' => 'DATETIME', 'null' => true],
                'created_at'  => ['type' => 'DATETIME', 'null' => true],
                'revoked'     => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addKey('user_id');
            $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE');
            $this->forge->createTable('user_sessions');
        }

        // Custom roles / RBAC
        if (!$this->db->tableExists('custom_roles')) {
            $this->forge->addField([
                'id'          => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
                'name'        => ['type' => 'VARCHAR', 'constraint' => 60],
                'description' => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
                'permissions' => ['type' => 'JSON', 'null' => true],
                'created_at'  => ['type' => 'DATETIME', 'null' => true],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->createTable('custom_roles');
        }
    }

    public function down(): void
    {
        foreach (['custom_roles','user_sessions','poker_votes','poker_sessions',
                  'task_label_pivot','task_templates','task_labels'] as $t) {
            $this->forge->dropTable($t, true);
        }
    }
}
