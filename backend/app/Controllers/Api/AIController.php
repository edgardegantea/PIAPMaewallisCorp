<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

/**
 * AI-powered project assistant using Claude API.
 *
 * POST /api/projects/:id/ai-summary
 * POST /api/projects/:id/ai-risks
 */
class AIController extends BaseController
{
    private function claudeRequest(string $prompt): string
    {
        $apiKey = env('ANTHROPIC_API_KEY', '');
        if (!$apiKey) {
            throw new \RuntimeException('ANTHROPIC_API_KEY no configurada en .env');
        }

        $payload = json_encode([
            'model'      => 'claude-sonnet-4-6',
            'max_tokens' => 1024,
            'messages'   => [['role' => 'user', 'content' => $prompt]],
        ]);

        $ch = curl_init('https://api.anthropic.com/v1/messages');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'x-api-key: ' . $apiKey,
                'anthropic-version: 2023-06-01',
            ],
            CURLOPT_TIMEOUT        => 30,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            throw new \RuntimeException('Error en API de Claude: HTTP ' . $httpCode);
        }

        $data = json_decode($response, true);
        return $data['content'][0]['text'] ?? '';
    }

    private function projectContext(int $projectId): array
    {
        $db = Database::connect();

        $project = $db->table('projects')->where('id', $projectId)->get()->getRowArray();
        if (!$project) return [];

        $tasks = $db->query("
            SELECT t.title, t.status, t.priority, t.due_date, t.estimated_hours,
                   s.name AS sprint_name
            FROM tasks t
            JOIN sprints s ON s.id = t.sprint_id
            WHERE s.project_id = ? AND t.parent_task_id IS NULL
            ORDER BY t.status, t.due_date
            LIMIT 50
        ", [$projectId])->getResultArray();

        $risks = $db->query("
            SELECT description, probability, impact, status
            FROM risks WHERE project_id = ? AND status = 'ACTIVO' LIMIT 10
        ", [$projectId])->getResultArray();

        $milestones = $db->query("
            SELECT title, due_date, is_completed FROM milestones
            WHERE project_id = ? ORDER BY due_date LIMIT 10
        ", [$projectId])->getResultArray();

        $stats = [
            'total'     => count($tasks),
            'done'      => count(array_filter($tasks, fn($t) => $t['status'] === 'COMPLETADA')),
            'blocked'   => count(array_filter($tasks, fn($t) => $t['status'] === 'BLOQUEADA')),
            'overdue'   => count(array_filter($tasks, fn($t) =>
                $t['due_date'] && new \DateTime($t['due_date']) < new \DateTime() && $t['status'] !== 'COMPLETADA'
            )),
        ];

        return compact('project', 'tasks', 'risks', 'milestones', 'stats');
    }

    // POST /api/projects/:id/ai-summary
    public function summary(int $projectId): ResponseInterface
    {
        try {
            $ctx = $this->projectContext($projectId);
            if (!$ctx) {
                return $this->response->setStatusCode(404)->setJSON(['message' => 'Proyecto no encontrado']);
            }

            $p = $ctx['project'];
            $s = $ctx['stats'];
            $risks     = array_map(fn($r) => "{$r['description']} ({$r['probability']}/{$r['impact']})", $ctx['risks']);
            $overdue   = array_filter($ctx['tasks'], fn($t) =>
                $t['due_date'] && new \DateTime($t['due_date']) < new \DateTime() && $t['status'] !== 'COMPLETADA'
            );

            $prompt = <<<PROMPT
Eres un experto en gestión de proyectos. Genera un resumen ejecutivo CONCISO del siguiente proyecto en español.
Formato: 3-4 párrafos cortos. Sin markdown. Sin encabezados.

Proyecto: {$p['name']} (Estado: {$p['status']})
Descripción: {$p['description']}
Inicio: {$p['planned_start_date']} — Fin planificado: {$p['planned_end_date']}

Tareas: {$s['total']} total, {$s['done']} completadas, {$s['blocked']} bloqueadas, {$s['overdue']} vencidas.
Hitos pendientes: {$ctx['milestones'][0]['title'] ?? 'Ninguno'} (vence {$ctx['milestones'][0]['due_date'] ?? 'N/A'})
Riesgos activos: {implode('; ', array_slice($risks, 0, 3))}

Genera el resumen ejecutivo enfocado en: avance general, riesgos principales y recomendaciones inmediatas.
PROMPT;

            $text = $this->claudeRequest($prompt);
            return $this->response->setJSON(['summary' => $text, 'generated_at' => date('Y-m-d H:i:s')]);

        } catch (\Throwable $e) {
            return $this->response->setStatusCode(500)->setJSON(['message' => $e->getMessage()]);
        }
    }

    // POST /api/projects/:id/ai-risks
    public function detectRisks(int $projectId): ResponseInterface
    {
        try {
            $ctx = $this->projectContext($projectId);
            if (!$ctx) {
                return $this->response->setStatusCode(404)->setJSON(['message' => 'Proyecto no encontrado']);
            }

            $s = $ctx['stats'];
            $blockedTasks = array_filter($ctx['tasks'], fn($t) => $t['status'] === 'BLOQUEADA');
            $blockedList  = implode('; ', array_column(array_slice(array_values($blockedTasks), 0, 5), 'title'));

            $prompt = <<<PROMPT
Analiza este proyecto y devuelve exactamente 3-5 riesgos detectados en formato JSON.
Responde SOLO con JSON válido, sin texto adicional.

Proyecto: {$ctx['project']['name']}
Estado: {$ctx['project']['status']}
Tareas bloqueadas: {$s['blocked']}
Tareas vencidas: {$s['overdue']}
Tareas bloqueadas: {$blockedList}
Riesgos ya registrados: {implode('; ', array_column($ctx['risks'], 'description'))}

Formato de respuesta:
[
  {"risk": "descripción del riesgo", "probability": "ALTA|MEDIA|BAJA", "impact": "ALTO|MEDIO|BAJO", "mitigation": "acción recomendada"}
]
PROMPT;

            $text = $this->claudeRequest($prompt);

            // Extract JSON from response
            preg_match('/\[.*\]/s', $text, $matches);
            $risks = $matches ? json_decode($matches[0], true) : [];

            return $this->response->setJSON(['risks' => $risks ?? [], 'generated_at' => date('Y-m-d H:i:s')]);

        } catch (\Throwable $e) {
            return $this->response->setStatusCode(500)->setJSON(['message' => $e->getMessage()]);
        }
    }
}
