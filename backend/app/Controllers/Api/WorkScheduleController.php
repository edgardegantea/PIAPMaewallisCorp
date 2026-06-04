<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Libraries\Auth;
use App\Models\WorkScheduleModel;
use App\Models\AttendanceRecordModel;
use App\Models\LeaveRequestModel;
use App\Models\UserModel;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Work schedules + attendance monthly report
 *
 * ADMIN:
 *   GET    /api/admin/work-schedule              – company default
 *   PUT    /api/admin/work-schedule              – save/update company default
 *   GET    /api/admin/work-schedule/user/:id     – user override
 *   PUT    /api/admin/work-schedule/user/:id     – save user override
 *   DELETE /api/admin/work-schedule/user/:id     – remove user override (revert to default)
 *   GET    /api/admin/attendance/report          – monthly attendance report (?year=&month=&user_id=)
 */
class WorkScheduleController extends BaseController
{
    private WorkScheduleModel   $schedules;
    private AttendanceRecordModel $records;
    private LeaveRequestModel   $leaves;
    private UserModel           $users;

    public function __construct()
    {
        $this->schedules = new WorkScheduleModel();
        $this->records   = new AttendanceRecordModel();
        $this->leaves    = new LeaveRequestModel();
        $this->users     = new UserModel();
    }

    // ── Schedule CRUD ─────────────────────────────────────────────────────────

    public function getDefault(): ResponseInterface
    {
        $s = $this->schedules->getDefault();
        return $this->response->setJSON($s ?? $this->defaultTemplate());
    }

    public function saveDefault(): ResponseInterface
    {
        $data = $this->request->getJSON(true) ?: $this->request->getPost();
        $existing = $this->schedules->getDefault();

        $fields = $this->extractScheduleFields($data);
        if ($existing) {
            $this->schedules->update($existing['id'], $fields);
            return $this->response->setJSON($this->schedules->find($existing['id']));
        }
        $id = $this->schedules->insert(array_merge($fields, ['user_id' => null]));
        return $this->response->setStatusCode(201)->setJSON($this->schedules->find($id));
    }

    public function getForUser(int $userId): ResponseInterface
    {
        return $this->response->setJSON($this->schedules->forUser($userId) ?? $this->defaultTemplate());
    }

    public function saveForUser(int $userId): ResponseInterface
    {
        if (!$this->users->find($userId)) {
            return $this->response->setStatusCode(404)->setJSON(['message' => 'Usuario no encontrado']);
        }
        $data     = $this->request->getJSON(true) ?: $this->request->getPost();
        $existing = $this->schedules->where('user_id', $userId)->first();
        $fields   = $this->extractScheduleFields($data);

        if ($existing) {
            $this->schedules->update($existing['id'], $fields);
            return $this->response->setJSON($this->schedules->find($existing['id']));
        }
        $id = $this->schedules->insert(array_merge($fields, ['user_id' => $userId]));
        return $this->response->setStatusCode(201)->setJSON($this->schedules->find($id));
    }

    public function deleteForUser(int $userId): ResponseInterface
    {
        $existing = $this->schedules->where('user_id', $userId)->first();
        if ($existing) $this->schedules->delete($existing['id']);
        return $this->response->setStatusCode(204)->setBody('');
    }

    // ── Monthly attendance report ─────────────────────────────────────────────

    public function report(): ResponseInterface
    {
        $year   = (int)($this->request->getGet('year')  ?? date('Y'));
        $month  = (int)($this->request->getGet('month') ?? date('n'));
        $userId = $this->request->getGet('user_id');

        $from = sprintf('%04d-%02d-01', $year, $month);
        $to   = date('Y-m-t', strtotime($from));

        // Get all active users (or one specific)
        if ($userId) {
            $userList = array_filter([$this->users->find((int)$userId)]);
        } else {
            $userList = $this->users->where('is_active', 1)->findAll();
        }

        $report = [];

        foreach ($userList as $user) {
            $uid      = (int)$user['id'];
            $schedule = $this->schedules->forUser($uid);
            $records  = $this->getAllRecordsForUserInRange($uid, $from, $to);
            $leaves   = $this->leaves->approvedInRange($uid, $from, $to);

            $row = $this->buildUserMonthRow($user, $schedule, $records, $leaves, $from, $to);
            $report[] = $row;
        }

        // Sort by name
        usort($report, fn($a, $b) => strcmp($a['user_name'], $b['user_name']));

        return $this->response->setJSON([
            'year'   => $year,
            'month'  => $month,
            'from'   => $from,
            'to'     => $to,
            'report' => $report,
        ]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function getAllRecordsForUserInRange(int $userId, string $from, string $to): array
    {
        $db = \Config\Database::connect();
        return $db->query("
            SELECT ar.*, al.name AS location_name
            FROM attendance_records ar
            LEFT JOIN attendance_locations al ON al.id = ar.location_id
            WHERE ar.user_id = ?
              AND DATE(ar.check_in_at) BETWEEN ? AND ?
            ORDER BY ar.check_in_at
        ", [$userId, $from, $to])->getResultArray();
    }

    private function buildUserMonthRow(array $user, ?array $schedule, array $records, array $leaves, string $from, string $to): array
    {
        $uid    = (int)$user['id'];
        $name   = trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? '')) ?: ($user['username'] ?? "User $uid");

        $totalWorkedSec   = 0;
        $totalOvertimeSec = 0;
        $presentDays      = 0;
        $tardyDays        = 0;
        $absentDays       = 0;
        $leaveDays        = 0;
        $geoViolations    = 0;
        $dailyDetails     = [];

        // Build set of leave dates
        $leaveDateSet = [];
        foreach ($leaves as $lr) {
            $d = new \DateTime($lr['start_date']);
            $e = new \DateTime($lr['end_date']);
            while ($d <= $e) {
                $leaveDateSet[$d->format('Y-m-d')] = $lr['type'];
                $d->modify('+1 day');
            }
            $leaveDays += (int)$lr['days_count'];
        }

        // Index records by date
        $recordsByDate = [];
        foreach ($records as $r) {
            $date = date('Y-m-d', strtotime($r['check_in_at']));
            $recordsByDate[$date][] = $r;
        }

        // Iterate each day of the month
        $cur = new \DateTime($from);
        $end = new \DateTime($to);

        while ($cur <= $end) {
            $dateStr = $cur->format('Y-m-d');
            $dow     = (int)$cur->format('N'); // 1=Mon..7=Sun
            $dayKey  = WorkScheduleModel::dayKey($dow);

            $isWorkday     = $schedule ? (bool)($schedule["{$dayKey}_active"] ?? false) : ($dow <= 5);
            $expectedStart = $schedule ? ($schedule["{$dayKey}_start"] ?? null) : null;
            $expectedEnd   = $schedule ? ($schedule["{$dayKey}_end"]   ?? null) : null;
            $expectedSec   = 0;
            $toleranceSec  = ($schedule ? (int)($schedule['tolerance_min'] ?? 10) : 10) * 60;

            if ($isWorkday && $expectedStart && $expectedEnd) {
                $expectedSec = strtotime($expectedEnd) - strtotime($expectedStart);
            }

            $dayRecords = $recordsByDate[$dateStr] ?? [];
            $isLeave    = isset($leaveDateSet[$dateStr]);

            if (!$isWorkday) {
                $cur->modify('+1 day');
                continue;
            }

            if ($isLeave) {
                $dailyDetails[$dateStr] = ['status' => 'permiso', 'type' => $leaveDateSet[$dateStr]];
                $cur->modify('+1 day');
                continue;
            }

            if (empty($dayRecords)) {
                // Today or future — don't count as absent
                if ($dateStr > date('Y-m-d')) {
                    $dailyDetails[$dateStr] = ['status' => 'futuro'];
                } else {
                    $absentDays++;
                    $dailyDetails[$dateStr] = ['status' => 'ausente'];
                }
                $cur->modify('+1 day');
                continue;
            }

            // Calculate worked time for the day
            $dayWorkedSec = 0;
            $isLate       = false;
            $hasGeoFail   = false;

            foreach ($dayRecords as $rec) {
                $inAt  = new \DateTime($rec['check_in_at']);
                $outAt = $rec['check_out_at'] ? new \DateTime($rec['check_out_at']) : null;

                if ($outAt) {
                    $dayWorkedSec += max(0, $outAt->getTimestamp() - $inAt->getTimestamp());
                } else {
                    // Open record → count until now or end of day
                    $now = min(time(), strtotime($dateStr . ' 23:59:59'));
                    $dayWorkedSec += max(0, $now - $inAt->getTimestamp());
                }

                // Check tardiness
                if ($expectedStart && !$isLate) {
                    $expected = strtotime($dateStr . ' ' . $expectedStart);
                    if ($inAt->getTimestamp() > ($expected + $toleranceSec)) {
                        $isLate = true;
                    }
                }

                if (!$rec['check_in_valid'] && $rec['check_in_lat'] !== null) {
                    $hasGeoFail = true;
                }
            }

            $overtimeSec = max(0, $dayWorkedSec - $expectedSec);

            $totalWorkedSec   += $dayWorkedSec;
            $totalOvertimeSec += $overtimeSec;
            $presentDays++;
            if ($isLate) $tardyDays++;
            if ($hasGeoFail) $geoViolations++;

            $dailyDetails[$dateStr] = [
                'status'      => $isLate ? 'tardanza' : 'presente',
                'worked_h'    => round($dayWorkedSec / 3600, 2),
                'overtime_h'  => round($overtimeSec / 3600, 2),
                'geo_ok'      => !$hasGeoFail,
                'records'     => count($dayRecords),
            ];

            $cur->modify('+1 day');
        }

        return [
            'user_id'        => $uid,
            'user_name'      => $name,
            'user_email'     => $user['email'] ?? '',
            'present_days'   => $presentDays,
            'absent_days'    => $absentDays,
            'tardy_days'     => $tardyDays,
            'leave_days'     => $leaveDays,
            'geo_violations' => $geoViolations,
            'total_hours'    => round($totalWorkedSec / 3600, 2),
            'overtime_hours' => round($totalOvertimeSec / 3600, 2),
            'daily'          => $dailyDetails,
        ];
    }

    private function extractScheduleFields(array $data): array
    {
        $days    = ['mon','tue','wed','thu','fri','sat','sun'];
        $fields  = ['name' => mb_substr(trim((string)($data['name'] ?? 'Horario estándar')), 0, 100)];
        foreach ($days as $d) {
            $fields["{$d}_start"]  = !empty($data["{$d}_start"])  ? $data["{$d}_start"]  : null;
            $fields["{$d}_end"]    = !empty($data["{$d}_end"])    ? $data["{$d}_end"]    : null;
            $fields["{$d}_active"] = isset($data["{$d}_active"])  ? (int)(bool)$data["{$d}_active"] : 0;
        }
        $fields['tolerance_min'] = max(0, (int)($data['tolerance_min'] ?? 10));
        return $fields;
    }

    private function defaultTemplate(): array
    {
        return [
            'id' => null, 'user_id' => null, 'name' => 'Horario estándar',
            'mon_start' => '09:00', 'mon_end' => '18:00', 'mon_active' => 1,
            'tue_start' => '09:00', 'tue_end' => '18:00', 'tue_active' => 1,
            'wed_start' => '09:00', 'wed_end' => '18:00', 'wed_active' => 1,
            'thu_start' => '09:00', 'thu_end' => '18:00', 'thu_active' => 1,
            'fri_start' => '09:00', 'fri_end' => '18:00', 'fri_active' => 1,
            'sat_start' => null,    'sat_end' => null,    'sat_active' => 0,
            'sun_start' => null,    'sun_end' => null,    'sun_active' => 0,
            'tolerance_min' => 10,
        ];
    }
}
