<?php
namespace App\Controllers\Api;
use App\Controllers\BaseController;
use App\Libraries\Auth;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

class DashboardWidgetsController extends BaseController
{
    public function index(): ResponseInterface
    {
        return $this->response->setJSON(Database::connect()->table('dashboard_widgets')->where('user_id',Auth::id())->orderBy('position')->get()->getResultArray());
    }
    public function save(): ResponseInterface
    {
        $db = Database::connect(); $widgets = $this->request->getJSON(true)['widgets'] ?? [];
        $db->table('dashboard_widgets')->where('user_id',Auth::id())->delete();
        foreach ($widgets as $i => $w) {
            $db->table('dashboard_widgets')->insert(['user_id'=>Auth::id(),'widget_type'=>$w['widget_type'],'position'=>$i,'col_span'=>$w['col_span']??1,'config'=>isset($w['config'])?json_encode($w['config']):null]);
        }
        return $this->response->setJSON(['ok'=>true,'saved'=>count($widgets)]);
    }
}
