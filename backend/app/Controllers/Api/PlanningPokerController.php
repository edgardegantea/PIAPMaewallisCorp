<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Libraries\Auth;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

/**
 * Planning Poker — collaborative estimation via polling.
 *
 * GET    /api/projects/:id/poker               list sessions
 * POST   /api/projects/:id/poker               { task_id? } — create session
 * GET    /api/poker/:id                        session details + votes
 * POST   /api/poker/:id/vote                   { vote: "3"|"5"|"8"|"?" }
 * POST   /api/poker/:id/reveal                 reveal votes
 * POST   /api/poker/:id/close                  close session (apply estimate to task)
 */
class PlanningPokerController extends BaseController
{
    private const CARDS = ['0','½','1','2','3','5','8','13','21','34','55','89','?','☕'];

    public function index(int $projectId): ResponseInterface
    {
        $db   = Database::connect();
        $rows = $db->query("
            SELECT ps.*, t.title AS task_title,
                   CONCAT(u.first_name,' ',u.last_name) AS created_by_name,
                   (SELECT COUNT(*) FROM poker_votes pv WHERE pv.session_id = ps.id) AS vote_count
            FROM poker_sessions ps
            LEFT JOIN tasks t ON t.id = ps.task_id
            LEFT JOIN users u ON u.id = ps.created_by
            WHERE ps.project_id = ?
            ORDER BY ps.created_at DESC LIMIT 20
        ", [$projectId])->getResultArray();
        return $this->response->setJSON($rows);
    }

    public function create(int $projectId): ResponseInterface
    {
        $db   = Database::connect();
        $data = $this->request->getJSON(true);

        $db->table('poker_sessions')->insert([
            'project_id' => $projectId,
            'task_id'    => $data['task_id'] ?? null,
            'status'     => 'VOTING',
            'created_by' => Auth::id(),
            'created_at' => date('Y-m-d H:i:s'),
        ]);
        $id = $db->insertID();
        return $this->response->setStatusCode(201)->setJSON($this->getSession($id));
    }

    public function show(int $id): ResponseInterface
    {
        return $this->response->setJSON($this->getSession($id));
    }

    public function vote(int $id): ResponseInterface
    {
        $db   = Database::connect();
        $data = $this->request->getJSON(true);
        $vote = $data['vote'] ?? '';

        $session = $db->table('poker_sessions')->where('id', $id)->get()->getRowArray();
        if (!$session || $session['status'] !== 'VOTING') {
            return $this->response->setStatusCode(422)->setJSON(['message' => 'La sesión no está en votación']);
        }

        $db->query("
            INSERT INTO poker_votes (session_id, user_id, vote, voted_at)
            VALUES (?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE vote = VALUES(vote), voted_at = NOW()
        ", [$id, Auth::id(), $vote]);

        return $this->response->setJSON($this->getSession($id));
    }

    public function reveal(int $id): ResponseInterface
    {
        $db = Database::connect();
        $db->table('poker_sessions')->where('id', $id)->update(['status' => 'REVEALED', 'revealed_at' => date('Y-m-d H:i:s')]);
        return $this->response->setJSON($this->getSession($id));
    }

    public function close(int $id): ResponseInterface
    {
        $db      = Database::connect();
        $data    = $this->request->getJSON(true);
        $estimate = $data['estimate'] ?? null; // agreed story points

        $session = $db->table('poker_sessions')->where('id', $id)->get()->getRowArray();
        $db->table('poker_sessions')->where('id', $id)->update(['status' => 'CLOSED']);

        // Apply estimate to the task if provided
        if ($estimate !== null && $session['task_id']) {
            $db->table('tasks')->where('id', $session['task_id'])->update(['story_points' => (int)$estimate]);
        }

        return $this->response->setJSON(['ok' => true, 'estimate' => $estimate]);
    }

    private function getSession(int $id): array
    {
        $db      = Database::connect();
        $session = $db->table('poker_sessions ps')
            ->select('ps.*, t.title AS task_title')
            ->join('tasks t', 't.id = ps.task_id', 'left')
            ->where('ps.id', $id)->get()->getRowArray();

        if (!$session) return [];

        $votes = $db->query("
            SELECT pv.vote, pv.voted_at,
                   CASE WHEN ps.status = 'REVEALED' THEN pv.vote ELSE '?' END AS display_vote,
                   CONCAT(u.first_name,' ',u.last_name) AS user_name, u.username,
                   u.id AS user_id
            FROM poker_votes pv
            JOIN poker_sessions ps ON ps.id = pv.session_id
            JOIN users u ON u.id = pv.user_id
            WHERE pv.session_id = ?
        ", [$id])->getResultArray();

        $session['votes'] = $votes;
        $session['cards'] = self::CARDS;

        // Consensus: most voted card (only if revealed)
        if ($session['status'] === 'REVEALED' && $votes) {
            $counts = array_count_values(array_column($votes, 'vote'));
            arsort($counts);
            $session['consensus'] = array_key_first($counts);
        }

        return $session;
    }
}
