<?php

namespace App\Models;

use CodeIgniter\Model;

class WorkScheduleModel extends Model
{
    protected $table         = 'work_schedules';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = true;

    protected $allowedFields = [
        'user_id', 'name',
        'mon_start','mon_end','mon_active',
        'tue_start','tue_end','tue_active',
        'wed_start','wed_end','wed_active',
        'thu_start','thu_end','thu_active',
        'fri_start','fri_end','fri_active',
        'sat_start','sat_end','sat_active',
        'sun_start','sun_end','sun_active',
        'tolerance_min',
    ];

    /** Company-wide default (user_id IS NULL) */
    public function getDefault(): ?array
    {
        return $this->where('user_id IS NULL', null, false)->first();
    }

    /** Per-user schedule, falls back to company default */
    public function forUser(int $userId): ?array
    {
        $personal = $this->where('user_id', $userId)->first();
        return $personal ?? $this->getDefault();
    }

    /** Day abbrevs indexed by PHP date('N') (1=Mon … 7=Sun) */
    public static function dayKey(int $iso): string
    {
        return ['1'=>'mon','2'=>'tue','3'=>'wed','4'=>'thu','5'=>'fri','6'=>'sat','7'=>'sun'][$iso] ?? 'mon';
    }

    /**
     * Calculate expected work seconds for a given schedule day.
     * Returns ['expected_sec', 'tolerance_sec']
     */
    public function dayExpected(array $schedule, string $dayAbbrev): array
    {
        if (!$schedule["{$dayAbbrev}_active"]) return ['expected_sec' => 0, 'tolerance_sec' => 0];
        $start = strtotime($schedule["{$dayAbbrev}_start"] ?? '00:00');
        $end   = strtotime($schedule["{$dayAbbrev}_end"]   ?? '00:00');
        return [
            'expected_sec'   => max(0, $end - $start),
            'tolerance_sec'  => (int)($schedule['tolerance_min'] ?? 10) * 60,
        ];
    }
}
