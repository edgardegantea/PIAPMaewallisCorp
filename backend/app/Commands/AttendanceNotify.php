<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use Config\Database;
use App\Models\WorkScheduleModel;
use App\Libraries\NotificationService;

/**
 * Sends absence notifications for users who haven't checked in
 * past their scheduled start time + tolerance.
 *
 * Usage:   php spark attendance:notify
 * Cron:    Add to crontab to run every 30 min on workdays:
 *   * /30 8-12 * * 1-5 php /path/to/spark attendance:notify
 */
class AttendanceNotify extends BaseCommand
{
    protected $group       = 'Attendance';
    protected $name        = 'attendance:notify';
    protected $description = 'Notifica a admins sobre usuarios que no han registrado entrada';

    public function run(array $params): void
    {
        $db        = Database::connect();
        $schedules = new WorkScheduleModel();
        $now       = new \DateTime();
        $today     = $now->format('Y-m-d');
        $dow       = (int)$now->format('N'); // 1=Mon..7=Sun
        $dayKey    = WorkScheduleModel::dayKey($dow);

        CLI::write("Verificando asistencia: {$today} {$now->format('H:i')}", 'yellow');

        // Get all active users
        $users = $db->table('users')
            ->select('id, first_name, last_name, email, username')
            ->where('is_active', 1)
            ->get()->getResultArray();

        $absent = [];

        foreach ($users as $user) {
            $uid      = (int)$user['id'];
            $schedule = $schedules->forUser($uid);

            if (!$schedule || !$schedule["{$dayKey}_active"]) continue;

            $startStr = $schedule["{$dayKey}_start"] ?? null;
            if (!$startStr) continue;

            $toleranceSec = ((int)($schedule['tolerance_min'] ?? 10)) * 60;
            $expectedAt   = strtotime("{$today} {$startStr}") + $toleranceSec;

            // Only run if we've passed expected start + tolerance
            if (time() < $expectedAt) continue;

            // Check if user has checked in today
            $record = $db->query(
                "SELECT id FROM attendance_records WHERE user_id = ? AND DATE(check_in_at) = ? LIMIT 1",
                [$uid, $today]
            )->getRowArray();

            if (!$record) {
                $absent[] = [
                    'user_id' => $uid,
                    'name'    => trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? '')) ?: $user['username'],
                    'email'   => $user['email'],
                    'expected'=> $startStr,
                ];
            }
        }

        if (empty($absent)) {
            CLI::write('Sin ausencias detectadas.', 'green');
            return;
        }

        CLI::write(count($absent) . ' usuario(s) sin registro de entrada:', 'red');
        foreach ($absent as $a) {
            CLI::write("  - {$a['name']} ({$a['email']}) — esperado: {$a['expected']}", 'light_gray');
        }

        // Create a system notification for each admin
        $admins = $db->table('users')
            ->where('role', 'ADMIN')
            ->where('is_active', 1)
            ->get()->getResultArray();

        $names = implode(', ', array_map(fn($a) => $a['name'], array_slice($absent, 0, 3)));
        $extra = count($absent) > 3 ? ' y ' . (count($absent) - 3) . ' más' : '';
        $msg   = count($absent) . " usuario(s) sin entrada: {$names}{$extra}";

        foreach ($admins as $admin) {
            try {
                $db->table('user_notifications')->insert([
                    'user_id'    => $admin['id'],
                    'title'      => '⚠️ Ausencias detectadas',
                    'body'       => $msg,
                    'type'       => 'absence_alert',
                    'is_read'    => 0,
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s'),
                ]);
            } catch (\Throwable $e) {
                CLI::write("Error notificando admin #{$admin['id']}: " . $e->getMessage(), 'red');
            }
        }

        CLI::write("Notificación enviada a " . count($admins) . " admin(s).", 'green');
    }
}
