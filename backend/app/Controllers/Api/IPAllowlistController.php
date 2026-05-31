<?php
namespace App\Controllers\Api;
use App\Controllers\BaseController;
use App\Libraries\Auth;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

class IPAllowlistController extends BaseController
{
    public function index(): ResponseInterface { return $this->response->setJSON(Database::connect()->table('ip_allowlist')->orderBy('created_at','DESC')->get()->getResultArray()); }
    public function create(): ResponseInterface
    {
        $db = Database::connect(); $data = $this->request->getJSON(true);
        if (empty($data['cidr'])) return $this->response->setStatusCode(422)->setJSON(['message'=>'CIDR requerido (ej. 192.168.1.0/24 o 1.2.3.4)']);
        $db->table('ip_allowlist')->insert(['cidr'=>$data['cidr'],'label'=>$data['label']??null,'is_active'=>1,'created_by'=>Auth::id(),'created_at'=>date('Y-m-d H:i:s')]);
        return $this->response->setStatusCode(201)->setJSON($db->table('ip_allowlist')->where('id',$db->insertID())->get()->getRowArray());
    }
    public function update(int $id): ResponseInterface
    {
        $db = Database::connect(); $data = $this->request->getJSON(true);
        $db->table('ip_allowlist')->where('id',$id)->update(array_intersect_key($data,array_flip(['cidr','label','is_active'])));
        return $this->response->setJSON($db->table('ip_allowlist')->where('id',$id)->get()->getRowArray());
    }
    public function delete(int $id): ResponseInterface { Database::connect()->table('ip_allowlist')->where('id',$id)->delete(); return $this->response->setStatusCode(204)->setBody(''); }

    public static function isAllowed(string $ip): bool
    {
        try {
            $db = Database::connect();
            $active = $db->table('ip_allowlist')->where('is_active',1)->get()->getResultArray();
            if (empty($active)) return true; // No rules = allow all
            foreach ($active as $rule) {
                if (self::ipInCidr($ip, $rule['cidr'])) return true;
            }
            return false;
        } catch (\Throwable $e) { return true; }
    }

    private static function ipInCidr(string $ip, string $cidr): bool
    {
        if (!str_contains($cidr,'/')) return $ip === $cidr;
        [$subnet,$bits] = explode('/',$cidr);
        $ip_long     = ip2long($ip);
        $subnet_long = ip2long($subnet);
        $mask        = -1 << (32 - (int)$bits);
        return ($ip_long & $mask) === ($subnet_long & $mask);
    }
}
