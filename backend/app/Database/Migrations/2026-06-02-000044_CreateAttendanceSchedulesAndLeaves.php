<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateAttendanceSchedulesAndLeaves extends Migration
{
    public function up(): void
    {
        // ── work_schedules ────────────────────────────────────────────────
        // user_id NULL = company-wide default schedule
        $this->forge->addField([
            'id'            => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'user_id'       => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            'name'          => ['type' => 'VARCHAR', 'constraint' => 100, 'default' => 'Horario estándar'],
            'mon_start'     => ['type' => 'TIME', 'null' => true],
            'mon_end'       => ['type' => 'TIME', 'null' => true],
            'mon_active'    => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 1],
            'tue_start'     => ['type' => 'TIME', 'null' => true],
            'tue_end'       => ['type' => 'TIME', 'null' => true],
            'tue_active'    => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 1],
            'wed_start'     => ['type' => 'TIME', 'null' => true],
            'wed_end'       => ['type' => 'TIME', 'null' => true],
            'wed_active'    => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 1],
            'thu_start'     => ['type' => 'TIME', 'null' => true],
            'thu_end'       => ['type' => 'TIME', 'null' => true],
            'thu_active'    => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 1],
            'fri_start'     => ['type' => 'TIME', 'null' => true],
            'fri_end'       => ['type' => 'TIME', 'null' => true],
            'fri_active'    => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 1],
            'sat_start'     => ['type' => 'TIME', 'null' => true],
            'sat_end'       => ['type' => 'TIME', 'null' => true],
            'sat_active'    => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
            'sun_start'     => ['type' => 'TIME', 'null' => true],
            'sun_end'       => ['type' => 'TIME', 'null' => true],
            'sun_active'    => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
            'tolerance_min' => ['type' => 'TINYINT', 'unsigned' => true, 'default' => 10],
            'created_at'    => ['type' => 'DATETIME', 'null' => true],
            'updated_at'    => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('user_id');
        $this->forge->createTable('work_schedules');

        // ── leave_requests ────────────────────────────────────────────────
        $this->forge->addField([
            'id'            => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'user_id'       => ['type' => 'INT', 'unsigned' => true],
            'type'          => ['type' => "ENUM('vacaciones','enfermedad','permiso','otro')", 'default' => 'permiso'],
            'start_date'    => ['type' => 'DATE'],
            'end_date'      => ['type' => 'DATE'],
            'days_count'    => ['type' => 'TINYINT', 'unsigned' => true, 'default' => 1],
            'reason'        => ['type' => 'TEXT', 'null' => true],
            'status'        => ['type' => "ENUM('pendiente','aprobado','rechazado','cancelado')", 'default' => 'pendiente'],
            'reviewed_by'   => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            'reviewed_at'   => ['type' => 'DATETIME', 'null' => true],
            'review_notes'  => ['type' => 'TEXT', 'null' => true],
            'created_at'    => ['type' => 'DATETIME', 'null' => true],
            'updated_at'    => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('user_id');
        $this->forge->addKey('start_date');
        $this->forge->createTable('leave_requests');
    }

    public function down(): void
    {
        $this->forge->dropTable('leave_requests', true);
        $this->forge->dropTable('work_schedules', true);
    }
}
