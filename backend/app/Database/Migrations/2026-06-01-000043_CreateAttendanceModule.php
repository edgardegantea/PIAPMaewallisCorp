<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateAttendanceModule extends Migration
{
    public function up(): void
    {
        // Locations defined by admin — where employees are allowed to check in
        $this->forge->addField([
            'id'          => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'name'        => ['type' => 'VARCHAR', 'constraint' => 150],
            'address'     => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'latitude'    => ['type' => 'DECIMAL', 'constraint' => '10,7'],
            'longitude'   => ['type' => 'DECIMAL', 'constraint' => '10,7'],
            'radius_m'    => ['type' => 'INT', 'unsigned' => true, 'default' => 100],
            'is_active'   => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 1],
            'created_by'  => ['type' => 'INT', 'unsigned' => true],
            'created_at'  => ['type' => 'DATETIME', 'null' => true],
            'updated_at'  => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->createTable('attendance_locations');

        // Attendance records — one per check-in/check-out pair
        $this->forge->addField([
            'id'              => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'user_id'         => ['type' => 'INT', 'unsigned' => true],
            'location_id'     => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            'check_in_at'     => ['type' => 'DATETIME'],
            'check_in_lat'    => ['type' => 'DECIMAL', 'constraint' => '10,7', 'null' => true],
            'check_in_lng'    => ['type' => 'DECIMAL', 'constraint' => '10,7', 'null' => true],
            'check_in_dist_m' => ['type' => 'INT', 'null' => true],
            'check_in_valid'  => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
            'check_out_at'    => ['type' => 'DATETIME', 'null' => true],
            'check_out_lat'   => ['type' => 'DECIMAL', 'constraint' => '10,7', 'null' => true],
            'check_out_lng'   => ['type' => 'DECIMAL', 'constraint' => '10,7', 'null' => true],
            'check_out_dist_m'=> ['type' => 'INT', 'null' => true],
            'check_out_valid' => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
            'notes'           => ['type' => 'TEXT', 'null' => true],
            'status'          => ['type' => "ENUM('open','closed','manual')", 'default' => 'open'],
            'created_at'      => ['type' => 'DATETIME', 'null' => true],
            'updated_at'      => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('user_id');
        $this->forge->addKey('check_in_at');
        $this->forge->createTable('attendance_records');
    }

    public function down(): void
    {
        $this->forge->dropTable('attendance_records', true);
        $this->forge->dropTable('attendance_locations', true);
    }
}
