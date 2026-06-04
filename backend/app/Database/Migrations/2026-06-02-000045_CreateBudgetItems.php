<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateBudgetItems extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'             => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'project_id'     => ['type' => 'INT', 'unsigned' => true],
            'category'       => ['type' => "ENUM('materiales','mano_obra','equipos','servicios','viajes','otros')", 'default' => 'otros'],
            'description'    => ['type' => 'VARCHAR', 'constraint' => 255],
            'planned_amount' => ['type' => 'DECIMAL', 'constraint' => '12,2', 'default' => 0],
            'actual_amount'  => ['type' => 'DECIMAL', 'constraint' => '12,2', 'default' => 0],
            'date'           => ['type' => 'DATE', 'null' => true],
            'notes'          => ['type' => 'TEXT', 'null' => true],
            'created_by'     => ['type' => 'INT', 'unsigned' => true],
            'created_at'     => ['type' => 'DATETIME', 'null' => true],
            'updated_at'     => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('project_id');
        $this->forge->createTable('budget_items');
    }

    public function down(): void
    {
        $this->forge->dropTable('budget_items', true);
    }
}
