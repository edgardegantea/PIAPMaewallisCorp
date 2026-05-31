<?php
namespace App\Database\Migrations;
use CodeIgniter\Database\Migration;

/**
 * Notificaciones persistentes por usuario (#1 — Real-time notifications)
 * Se crean desde NotificationService al ocurrir eventos relevantes.
 */
class CreateUserNotifications extends Migration
{
    public function up(): void
    {
        if ($this->db->tableExists('user_notifications')) return;

        $this->forge->addField([
            'id'          => ['type'=>'INT','unsigned'=>true,'auto_increment'=>true],
            'user_id'     => ['type'=>'INT','unsigned'=>true],
            'type'        => ['type'=>'VARCHAR','constraint'=>60],
            'title'       => ['type'=>'VARCHAR','constraint'=>255],
            'body'        => ['type'=>'VARCHAR','constraint'=>500,'null'=>true],
            'link'        => ['type'=>'VARCHAR','constraint'=>500,'null'=>true],
            'entity_type' => ['type'=>'VARCHAR','constraint'=>50,'null'=>true],
            'entity_id'   => ['type'=>'INT','unsigned'=>true,'null'=>true],
            'project_id'  => ['type'=>'INT','unsigned'=>true,'null'=>true],
            'is_read'     => ['type'=>'TINYINT','constraint'=>1,'default'=>0],
            'created_at'  => ['type'=>'DATETIME','null'=>true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('user_id');
        $this->forge->addKey(['user_id','is_read']);
        $this->forge->addForeignKey('user_id','users','id','CASCADE','CASCADE');
        $this->forge->createTable('user_notifications');
    }

    public function down(): void
    {
        $this->forge->dropTable('user_notifications', true);
    }
}
