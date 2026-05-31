<?php
namespace App\Controllers\Api;
use App\Controllers\BaseController;
use App\Libraries\Auth;
use App\Libraries\EmailService;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

class DocSignaturesController extends BaseController
{
    public function index(int $docId): ResponseInterface
    {
        return $this->response->setJSON(Database::connect()->query("SELECT ds.*,CONCAT(u.first_name,' ',u.last_name) AS user_name FROM doc_signatures ds LEFT JOIN users u ON u.id=ds.user_id WHERE ds.doc_id=? ORDER BY ds.signed_at",[$docId])->getResultArray());
    }

    public function sign(int $docId): ResponseInterface
    {
        $db   = Database::connect();
        $data = $this->request->getJSON(true);
        $user = Auth::user();

        // Check if already signed
        $existing = $db->table('doc_signatures')->where('doc_id',$docId)->where('user_id',Auth::id())->get()->getRowArray();
        if ($existing) return $this->response->setStatusCode(409)->setJSON(['message'=>'Ya firmaste este documento']);

        $doc  = $db->table('project_technical_docs')->where('id',$docId)->get()->getRowArray();
        if (!$doc) return $this->response->setStatusCode(404)->setJSON(['message'=>'Documento no encontrado']);

        $signedAt = date('Y-m-d H:i:s');
        $hash = hash('sha256', $docId.$user['id'].$signedAt.env('JWT_SECRET','piap'));

        $db->table('doc_signatures')->insert(['doc_id'=>$docId,'user_id'=>Auth::id(),'signer_name'=>($user['first_name'].' '.$user['last_name']),'signer_email'=>$user['email'],'signature_hash'=>$hash,'signed_at'=>$signedAt,'ip_address'=>$this->request->getIPAddress()]);

        // Email confirmation
        EmailService::send($user['email'],'Confirmación de firma digital',"<p>Has firmado digitalmente el documento <strong>{$doc['title']}</strong>.</p><p>Hash: <code>{$hash}</code></p><p>Fecha: {$signedAt}</p>");

        return $this->response->setStatusCode(201)->setJSON(['hash'=>$hash,'signed_at'=>$signedAt]);
    }

    public function verify(int $docId): ResponseInterface
    {
        $db   = Database::connect();
        $hash = $this->request->getGet('hash');
        $sig  = $db->table('doc_signatures')->where('doc_id',$docId)->where('signature_hash',$hash)->get()->getRowArray();
        return $this->response->setJSON(['valid'=>(bool)$sig,'signature'=>$sig]);
    }
}
