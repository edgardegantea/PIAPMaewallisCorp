<?php
namespace App\Controllers\Api;
use App\Controllers\BaseController;
use App\Libraries\Auth;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

class StandupController extends BaseController
{
    // GET  /projects/:id/standup               → today's questions + existing answers
    public function index(int $projectId): ResponseInterface
    {
        $db   = Database::connect();
        $date = date('Y-m-d');
        $dow  = (int)date('N'); // 1=Mon...7=Sun

        $questions = $db->query("
            SELECT q.*,
                   (SELECT a.answer FROM standup_answers a WHERE a.question_id=q.id AND a.user_id=? AND a.answer_date=? LIMIT 1) AS my_answer
            FROM standup_questions q
            WHERE q.project_id=? AND q.is_active=1
              AND (q.schedule='daily' OR (q.schedule='weekly' AND q.day_of_week=?))
            ORDER BY q.id
        ", [Auth::id(), $date, $projectId, $dow])->getResultArray();

        // Today's answers from all members
        $answers = $db->query("
            SELECT a.*, q.question, CONCAT(u.first_name,' ',u.last_name) AS user_name, u.username
            FROM standup_answers a
            JOIN standup_questions q ON q.id = a.question_id
            JOIN users u ON u.id = a.user_id
            WHERE q.project_id=? AND a.answer_date=?
            ORDER BY u.first_name, q.id
        ", [$projectId, $date])->getResultArray();

        return $this->response->setJSON(['questions'=>$questions,'answers'=>$answers,'date'=>$date]);
    }

    // POST /projects/:id/standup/questions     { question, schedule, day_of_week }
    public function createQuestion(int $projectId): ResponseInterface
    {
        $db = Database::connect(); $data = $this->request->getJSON(true);
        if (empty($data['question'])) return $this->response->setStatusCode(422)->setJSON(['message'=>'Pregunta requerida']);
        $db->table('standup_questions')->insert(['project_id'=>$projectId,'question'=>$data['question'],'schedule'=>$data['schedule']??'daily','day_of_week'=>$data['day_of_week']??null,'is_active'=>1,'created_at'=>date('Y-m-d H:i:s')]);
        return $this->response->setStatusCode(201)->setJSON($db->table('standup_questions')->where('id',$db->insertID())->get()->getRowArray());
    }

    // POST /standup/:id/answer                 { answer }
    public function answer(int $questionId): ResponseInterface
    {
        $db = Database::connect(); $data = $this->request->getJSON(true);
        $date = date('Y-m-d');
        $db->query("INSERT INTO standup_answers (question_id,user_id,answer,answer_date,created_at) VALUES (?,?,?,?,NOW()) ON DUPLICATE KEY UPDATE answer=VALUES(answer)",[$questionId,Auth::id(),$data['answer']??'',$date]);
        return $this->response->setJSON(['ok'=>true]);
    }

    // DELETE /standup/questions/:id
    public function deleteQuestion(int $id): ResponseInterface
    {
        Database::connect()->table('standup_questions')->where('id',$id)->delete();
        return $this->response->setStatusCode(204)->setBody('');
    }

    // GET /projects/:id/standup/history?days=7
    public function history(int $projectId): ResponseInterface
    {
        $db   = Database::connect();
        $days = (int)($this->request->getGet('days') ?? 7);
        $rows = $db->query("
            SELECT a.answer_date, q.question, a.answer,
                   CONCAT(u.first_name,' ',u.last_name) AS user_name, u.username
            FROM standup_answers a
            JOIN standup_questions q ON q.id=a.question_id
            JOIN users u ON u.id=a.user_id
            WHERE q.project_id=? AND a.answer_date >= DATE_SUB(CURDATE(),INTERVAL ? DAY)
            ORDER BY a.answer_date DESC, u.first_name
        ", [$projectId, $days])->getResultArray();
        return $this->response->setJSON($rows);
    }
}
