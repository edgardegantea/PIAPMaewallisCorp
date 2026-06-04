<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Libraries\Auth;
use App\Libraries\AuditLog;
use App\Models\ProjectModel;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

/**
 * Bulk project import from CSV — admin only.
 *
 * POST /api/admin/projects/import/csv     multipart: file
 * GET  /api/admin/projects/import/csv-template
 *
 * CSV columns (* = required):
 *   code*, name*, description, category (name), status, priority,
 *   director (username), sponsor (username),
 *   planned_start_date, planned_end_date,
 *   planned_budget, client_name, client_email, client_phone,
 *   objectives, scope, deliverables, notes
 */
class ProjectImportController extends BaseController
{
    private const VALID_STATUSES  = ['INICIACION','PLANIFICACION','EJECUCION','MONITOREO','CIERRE','PAUSADO','CANCELADO'];
    private const VALID_PRIORITIES = ['BAJA','MEDIA','ALTA','CRITICA'];

    public function import(): ResponseInterface
    {
        $file = $this->request->getFile('file');
        if (!$file || !$file->isValid()) {
            return $this->response->setStatusCode(422)
                ->setJSON(['message' => 'Archivo CSV requerido']);
        }

        if (strtolower($file->getClientExtension()) !== 'csv') {
            return $this->response->setStatusCode(422)
                ->setJSON(['message' => 'Solo se aceptan archivos .csv']);
        }

        $handle  = fopen($file->getTempName(), 'r');
        $rawHdr  = fgetcsv($handle);
        if (!$rawHdr) {
            fclose($handle);
            return $this->response->setStatusCode(422)
                ->setJSON(['message' => 'El archivo CSV está vacío']);
        }
        $headers = array_map('strtolower', array_map('trim', $rawHdr));

        foreach (['code', 'name'] as $req) {
            if (!in_array($req, $headers)) {
                fclose($handle);
                return $this->response->setStatusCode(422)
                    ->setJSON(['message' => "Columna requerida faltante: \"{$req}\""]);
            }
        }

        $db = Database::connect();

        // Build lookup maps
        $categories = $db->table('project_categories')->get()->getResultArray();
        $catMap = array_combine(
            array_map(fn($c) => strtolower($c['name']), $categories),
            array_column($categories, 'id')
        );

        $users = $db->table('users')->select('id, username')->get()->getResultArray();
        $userMap = array_combine(
            array_map(fn($u) => strtolower($u['username']), $users),
            array_column($users, 'id')
        );

        $model   = new ProjectModel();
        $created = 0;
        $skipped = 0;
        $errors  = [];
        $row     = 1;

        while (($line = fgetcsv($handle)) !== false) {
            $row++;
            if (array_filter($line, fn($v) => trim($v) !== '') === []) continue;

            $data = array_combine($headers, array_pad($line, count($headers), ''));

            $code = strtoupper(trim($data['code'] ?? ''));
            $name = trim($data['name'] ?? '');

            if (!$code) { $errors[] = "Fila {$row}: código vacío — omitida"; $skipped++; continue; }
            if (!$name) { $errors[] = "Fila {$row}: nombre vacío — omitida"; $skipped++; continue; }

            // Skip if code already exists
            if ($model->where('code', $code)->countAllResults() > 0) {
                $errors[] = "Fila {$row}: código \"{$code}\" ya existe — omitida";
                $skipped++;
                continue;
            }

            $status = strtoupper(trim($data['status'] ?? 'INICIACION'));
            if (!in_array($status, self::VALID_STATUSES)) $status = 'INICIACION';

            $priority = strtoupper(trim($data['priority'] ?? 'MEDIA'));
            if (!in_array($priority, self::VALID_PRIORITIES)) $priority = 'MEDIA';

            $catKey    = strtolower(trim($data['category'] ?? ''));
            $catId     = !empty($catKey) ? ($catMap[$catKey] ?? null) : null;

            $dirKey    = strtolower(trim($data['director'] ?? ''));
            $dirId     = !empty($dirKey) ? ($userMap[$dirKey] ?? null) : null;

            $sponKey   = strtolower(trim($data['sponsor'] ?? ''));
            $sponId    = !empty($sponKey) ? ($userMap[$sponKey] ?? null) : null;

            $toDate = fn($v) => !empty(trim($v)) ? trim($v) : null;
            $toNum  = fn($v) => is_numeric(trim($v)) ? (float)trim($v) : null;

            $model->insert([
                'code'               => $code,
                'name'               => $name,
                'description'        => trim($data['description'] ?? '') ?: null,
                'category_id'        => $catId,
                'status'             => $status,
                'priority'           => $priority,
                'director_id'        => $dirId,
                'sponsor_id'         => $sponId,
                'planned_start_date' => $toDate($data['planned_start_date'] ?? ''),
                'planned_end_date'   => $toDate($data['planned_end_date'] ?? ''),
                'planned_budget'     => $toNum($data['planned_budget'] ?? ''),
                'client_name'        => trim($data['client_name'] ?? '') ?: null,
                'client_email'       => trim($data['client_email'] ?? '') ?: null,
                'client_phone'       => trim($data['client_phone'] ?? '') ?: null,
                'objectives'         => trim($data['objectives'] ?? '') ?: null,
                'scope'              => trim($data['scope'] ?? '') ?: null,
                'deliverables'       => trim($data['deliverables'] ?? '') ?: null,
                'notes'              => trim($data['notes'] ?? '') ?: null,
                'completion_percentage' => 0,
                'is_active'          => 1,
            ]);

            AuditLog::record('project_created_via_csv', 'project', $model->getInsertID(), [
                'code' => $code, 'name' => $name,
            ]);

            $created++;
        }

        fclose($handle);

        return $this->response->setJSON([
            'created' => $created,
            'skipped' => $skipped,
            'errors'  => $errors,
            'message' => "{$created} proyecto(s) importado(s)" .
                ($skipped ? ", {$skipped} omitido(s)" : ''),
        ]);
    }

    public function template(): ResponseInterface
    {
        $headers = [
            'code','name','description','category','status','priority',
            'director','sponsor',
            'planned_start_date','planned_end_date',
            'planned_budget','client_name','client_email','client_phone',
            'objectives','scope','deliverables','notes',
        ];

        $example = [
            'PRY-001',
            'Sistema de Facturación Digital',
            'Desarrollo del módulo de facturación electrónica con CFDI 4.0',
            'Tecnología',
            'PLANIFICACION',
            'ALTA',
            'juan.perez',
            'maria.garcia',
            '2026-07-01',
            '2026-12-31',
            '250000',
            'Empresa ABC S.A. de C.V.',
            'contacto@empresaabc.com',
            '555-1234-567',
            'Automatizar la generación de facturas electrónicas',
            'Módulo de facturación integrado al ERP existente',
            'Sistema en producción con reportes mensuales',
            'Primera fase del proyecto de transformación digital',
        ];

        $csv  = implode(',', array_map(fn($h) => "\"{$h}\"", $headers)) . "\n";
        $csv .= implode(',', array_map(fn($v) => "\"{$v}\"", $example)) . "\n";

        // Status reference comment rows
        $csv .= "\n";
        $csv .= "\"# REFERENCIA — status válidos:\",\"INICIACION | PLANIFICACION | EJECUCION | MONITOREO | CIERRE | PAUSADO | CANCELADO\"\n";
        $csv .= "\"# REFERENCIA — priority válidos:\",\"BAJA | MEDIA | ALTA | CRITICA\"\n";
        $csv .= "\"# NOTA:\",\"director y sponsor deben ser usernames existentes. category debe coincidir con el nombre de una categoría.\"\n";

        return $this->response
            ->setHeader('Content-Type', 'text/csv; charset=UTF-8')
            ->setHeader('Content-Disposition', 'attachment; filename="plantilla_importar_proyectos.csv"')
            ->setBody($csv);
    }
}
