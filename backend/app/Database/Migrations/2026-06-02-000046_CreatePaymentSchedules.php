<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreatePaymentSchedules extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'          => ['type' => 'INT',  'unsigned' => true, 'auto_increment' => true],
            'project_id'  => ['type' => 'INT',  'unsigned' => true],
            'concept'     => ['type' => 'VARCHAR', 'constraint' => 255],
            'amount'      => ['type' => 'DECIMAL', 'constraint' => '12,2'],
            'due_date'    => ['type' => 'DATE'],
            'status'      => ['type' => "ENUM('pendiente','pagado','atrasado','cancelado')", 'default' => 'pendiente'],
            'paid_at'     => ['type' => 'DATE', 'null' => true],
            'milestone_id'=> ['type' => 'INT',  'unsigned' => true, 'null' => true],
            'notes'       => ['type' => 'TEXT', 'null' => true],
            'created_by'  => ['type' => 'INT',  'unsigned' => true],
            'created_at'  => ['type' => 'DATETIME', 'null' => true],
            'updated_at'  => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('project_id');
        $this->forge->createTable('payment_schedules');
    }

    public function down(): void
    {
        $this->forge->dropTable('payment_schedules', true);
    }
}
