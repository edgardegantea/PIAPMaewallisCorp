<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateAccessRequests extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'             => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'user_id'        => ['type' => 'INT', 'unsigned' => true],
            'resource_type'  => ['type' => "ENUM('proyecto','categoria','plantilla','usuario','configuracion','presupuesto','reporte','otro')", 'default' => 'otro'],
            'resource_id'    => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            'resource_name'  => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'action'         => ['type' => "ENUM('crear','editar','eliminar','aprobar','ver')", 'default' => 'crear'],
            'reason'         => ['type' => 'TEXT'],
            'status'         => ['type' => "ENUM('pendiente','aprobado','rechazado','expirado','completado')", 'default' => 'pendiente'],
            'reviewed_by'    => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            'reviewed_at'    => ['type' => 'DATETIME', 'null' => true],
            'review_notes'   => ['type' => 'TEXT', 'null' => true],
            'expires_at'     => ['type' => 'DATETIME', 'null' => true],
            'created_at'     => ['type' => 'DATETIME', 'null' => true],
            'updated_at'     => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('user_id');
        $this->forge->addKey('status');
        $this->forge->createTable('access_requests');
    }

    public function down(): void
    {
        $this->forge->dropTable('access_requests', true);
    }
}
