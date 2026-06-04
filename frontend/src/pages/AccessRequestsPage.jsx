import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  ShieldCheck, Plus, CheckCircle2, XCircle, Clock, X,
  Save, RefreshCw, Filter, AlertTriangle, Inbox,
} from 'lucide-react';
import { accessRequestsAPI } from '../services/accessRequestsAPI';
import { useAuthStore } from '../stores/authStore';
import Layout from '../components/Layout';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const RESOURCE_TYPES = [
  { value: 'proyecto',       label: 'Proyecto'       },
  { value: 'categoria',      label: 'Categoría'      },
  { value: 'plantilla',      label: 'Plantilla'      },
  { value: 'usuario',        label: 'Usuario'        },
  { value: 'configuracion',  label: 'Configuración'  },
  { value: 'presupuesto',    label: 'Presupuesto'    },
  { value: 'reporte',        label: 'Reporte'        },
  { value: 'otro',           label: 'Otro'           },
];

const ACTIONS = [
  { value: 'crear',    label: 'Crear'    },
  { value: 'editar',   label: 'Editar'   },
  { value: 'eliminar', label: 'Eliminar' },
  { value: 'aprobar',  label: 'Aprobar'  },
  { value: 'ver',      label: 'Ver'      },
];

const STATUS_STYLES = {
  pendiente:  { label: 'Pendiente',  cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',     icon: Clock        },
  aprobado:   { label: 'Aprobado',   cls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400', icon: CheckCircle2 },
  rechazado:  { label: 'Rechazado',  cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',             icon: XCircle      },
  expirado:   { label: 'Expirado',   cls: 'bg-slate-100 dark:bg-slate-700 text-slate-500',                            icon: Clock        },
  completado: { label: 'Completado', cls: 'bg-slate-100 dark:bg-slate-700 text-slate-500',                            icon: CheckCircle2 },
};

function fmtDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─────────────────────────────────────────────────────────────────────────────
// New Request Modal
// ─────────────────────────────────────────────────────────────────────────────

function NewRequestModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    resource_type: 'proyecto',
    resource_name: '',
    action:        'crear',
    reason:        '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const inp = 'w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400';

  const submit = async e => {
    e.preventDefault();
    if (!form.reason.trim()) { toast.error('El motivo es obligatorio'); return; }
    setSaving(true);
    try {
      await accessRequestsAPI.create(form);
      toast.success('Solicitud enviada — el administrador recibirá una notificación');
      onSaved();
    } catch (err) {
      const msg = err.response?.data?.message ?? 'Error al enviar';
      if (err.response?.status === 409) {
        toast.warning(msg);
        onSaved();
      } else {
        toast.error(msg);
      }
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <ShieldCheck size={16} className="text-indigo-500"/> Nueva solicitud de acceso
          </h2>
          <button onClick={onClose}><X size={18} className="text-slate-400"/></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Recurso</label>
              <select className={inp} value={form.resource_type} onChange={e => set('resource_type', e.target.value)}>
                {RESOURCE_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Acción</label>
              <select className={inp} value={form.action} onChange={e => set('action', e.target.value)}>
                {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Nombre / descripción del elemento
            </label>
            <input className={inp} value={form.resource_name} onChange={e => set('resource_name', e.target.value)}
              placeholder='Ej. "Categoría: Infraestructura TI" o "Proyecto: Sistema de Ventas"'/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Motivo de la solicitud *
            </label>
            <textarea className={`${inp} h-28 resize-none`} value={form.reason}
              onChange={e => set('reason', e.target.value)} required
              placeholder="Explica por qué necesitas este acceso y cómo lo utilizarás..."/>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5"/>
            <span>El administrador revisará tu solicitud. Recibirás una notificación con la decisión. Los permisos aprobados tienen una vigencia de 7 días.</span>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-2 disabled:opacity-60 transition-colors">
              <Save size={14}/> {saving ? 'Enviando...' : 'Enviar solicitud'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Review Modal (admin/director)
// ─────────────────────────────────────────────────────────────────────────────

function ReviewModal({ request, action, onClose, onSaved }) {
  const [form, setForm] = useState({ notes: '', expires_days: 7 });
  const [saving, setSaving] = useState(false);
  const inp = 'w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400';

  const submit = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      action === 'approve'
        ? await accessRequestsAPI.approve(request.id, form)
        : await accessRequestsAPI.reject(request.id, form);
      toast.success(action === 'approve' ? 'Solicitud aprobada' : 'Solicitud rechazada');
      onSaved();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Error'); }
    finally { setSaving(false); }
  };

  const isApprove = action === 'approve';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            {isApprove
              ? <><CheckCircle2 size={16} className="text-emerald-500"/> Aprobar solicitud</>
              : <><XCircle size={16} className="text-red-500"/> Rechazar solicitud</>}
          </h2>
          <button onClick={onClose}><X size={18} className="text-slate-400"/></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {/* Request summary */}
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-1 text-sm">
            <p className="text-slate-500 text-xs uppercase tracking-wide font-semibold">Solicitud de</p>
            <p className="font-medium text-slate-800 dark:text-slate-100">{request.user_name}</p>
            <p className="text-slate-500">{request.action} · {RESOURCE_TYPES.find(r => r.value === request.resource_type)?.label}</p>
            {request.resource_name && <p className="text-slate-600 dark:text-slate-300">"{request.resource_name}"</p>}
            <p className="text-slate-500 text-xs mt-1">{request.reason}</p>
          </div>

          {isApprove && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Vigencia del permiso (días)
              </label>
              <input className={inp} type="number" min={1} max={365} value={form.expires_days}
                onChange={e => setForm(f => ({ ...f, expires_days: e.target.value }))}/>
              <p className="text-xs text-slate-400 mt-1">El permiso expirará automáticamente después de este período.</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              {isApprove ? 'Comentario (opcional)' : 'Motivo del rechazo'}
            </label>
            <textarea className={`${inp} h-24 resize-none`} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder={isApprove ? 'Instrucciones adicionales...' : 'Explica por qué se rechaza la solicitud...'}
              required={!isApprove}/>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className={`flex-1 py-2 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-2 disabled:opacity-60 transition-colors
                ${isApprove ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>
              {isApprove ? <CheckCircle2 size={14}/> : <XCircle size={14}/>}
              {saving ? 'Procesando...' : isApprove ? 'Aprobar' : 'Rechazar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Request card
// ─────────────────────────────────────────────────────────────────────────────

function RequestCard({ req, isManager, onApprove, onReject, onCancel }) {
  const st     = STATUS_STYLES[req.status] ?? STATUS_STYLES.pendiente;
  const StIcon = st.icon;
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0 space-y-1">
          {isManager && req.user_name && (
            <p className="text-xs text-slate-500 font-medium">{req.user_name}
              <span className="ml-1 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 text-xs">{req.user_role}</span>
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-slate-800 dark:text-slate-100 capitalize">{req.action}</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-600 dark:text-slate-300">{RESOURCE_TYPES.find(r => r.value === req.resource_type)?.label ?? req.resource_type}</span>
            {req.resource_name && <span className="text-xs text-slate-400">"{req.resource_name}"</span>}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
              <StIcon size={10}/> {st.label}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{req.reason}</p>
          {req.review_notes && (
            <p className="text-xs italic text-slate-400">Nota del revisor: "{req.review_notes}"</p>
          )}
          <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
            <span>{fmtDate(req.created_at)}</span>
            {req.expires_at && req.status === 'aprobado' && (
              <span className="text-emerald-600">Expira: {fmtDate(req.expires_at)}</span>
            )}
            {req.reviewer_name && <span>Revisado por: {req.reviewer_name}</span>}
          </div>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          {isManager && req.status === 'pendiente' && (
            <>
              <button onClick={() => onApprove(req)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">
                <CheckCircle2 size={11}/> Aprobar
              </button>
              <button onClick={() => onReject(req)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-700 text-white transition-colors">
                <XCircle size={11}/> Rechazar
              </button>
            </>
          )}
          {!isManager && req.status === 'pendiente' && onCancel && (
            <button onClick={() => onCancel(req.id)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              <X size={11}/> Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function AccessRequestsPage() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'ADMIN' || user?.role === 'DIRECTOR';

  const [tab,         setTab]        = useState(isManager ? 'all' : 'my');
  const [requests,    setRequests]   = useState([]);
  const [myRequests,  setMyRequests] = useState([]);
  const [loading,     setLoading]    = useState(false);
  const [showModal,   setShowModal]  = useState(false);
  const [reviewing,   setReviewing]  = useState(null); // { request, action }
  const [filterStatus,setFilterStatus] = useState('');

  const loadAll = useCallback(async () => {
    if (!isManager) return;
    setLoading(true);
    try {
      const params = filterStatus ? { status: filterStatus } : {};
      const { data } = await accessRequestsAPI.all(params);
      setRequests(data);
    } catch { toast.error('Error al cargar solicitudes'); }
    finally { setLoading(false); }
  }, [isManager, filterStatus]);

  const loadMy = useCallback(async () => {
    setLoading(true);
    try { const { data } = await accessRequestsAPI.my(); setMyRequests(data); }
    catch { toast.error('Error al cargar tus solicitudes'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === 'all' && isManager) loadAll();
    if (tab === 'my') loadMy();
  }, [tab]);

  const handleCancel = async (id) => {
    if (!confirm('¿Cancelar esta solicitud?')) return;
    try { await accessRequestsAPI.cancel(id); toast.success('Solicitud cancelada'); loadMy(); }
    catch (err) { toast.error(err.response?.data?.message ?? 'Error'); }
  };

  const pendingCount = requests.filter(r => r.status === 'pendiente').length;

  const tabItems = [
    ...(isManager ? [{ key: 'all', label: `Todas${pendingCount > 0 ? ` (${pendingCount} pendientes)` : ''}` }] : []),
    { key: 'my', label: 'Mis solicitudes' },
  ];

  const currentList = tab === 'all' ? requests : myRequests;

  return (
    <Layout>
      <div className="px-6 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
              <ShieldCheck className="text-indigo-600 dark:text-indigo-400" size={20}/>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Solicitudes de acceso</h1>
              <p className="text-sm text-slate-500">
                {isManager
                  ? 'Aprueba o rechaza solicitudes de acceso elevado'
                  : 'Solicita permisos adicionales al administrador'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { if (tab === 'all') loadAll(); else loadMy(); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors">
              <RefreshCw size={14}/> Actualizar
            </button>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
              <Plus size={14}/> Nueva solicitud
            </button>
          </div>
        </div>

        {/* Info banner para Director/PM */}
        {!isManager && (
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-4 flex items-start gap-3">
            <ShieldCheck size={18} className="text-indigo-500 flex-shrink-0 mt-0.5"/>
            <div className="text-sm text-indigo-800 dark:text-indigo-300">
              <p className="font-semibold mb-1">¿Necesitas acceso a una función restringida?</p>
              <p>Envía una solicitud explicando qué necesitas y por qué. El administrador la revisará y recibirás una notificación con su decisión. Los permisos aprobados tienen vigencia de 7 días por defecto.</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-0.5 border-b border-slate-200 dark:border-slate-700">
          {tabItems.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors -mb-px
                ${tab === t.key ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Filters (admin) */}
        {tab === 'all' && isManager && (
          <div className="flex items-center gap-3 flex-wrap">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100">
              <option value="">Todos los estados</option>
              {Object.entries(STATUS_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <button onClick={loadAll}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
              <Filter size={13}/> Filtrar
            </button>
          </div>
        )}

        {/* List */}
        {loading ? (
          <p className="text-sm text-slate-400 animate-pulse">Cargando...</p>
        ) : currentList.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-12 text-center">
            <Inbox size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3"/>
            <p className="font-medium text-slate-500 mb-1">
              {tab === 'all' ? 'Sin solicitudes' : 'No has realizado solicitudes aún'}
            </p>
            <p className="text-sm text-slate-400">
              {tab === 'my' && 'Usa el botón "Nueva solicitud" para pedir acceso a una función restringida.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {currentList.map(req => (
              <RequestCard
                key={req.id}
                req={req}
                isManager={isManager}
                onApprove={isManager ? (r) => setReviewing({ request: r, action: 'approve' }) : null}
                onReject={isManager  ? (r) => setReviewing({ request: r, action: 'reject'  }) : null}
                onCancel={!isManager ? handleCancel : null}
              />
            ))}
          </div>
        )}

        {/* Modals */}
        {showModal && (
          <NewRequestModal
            onClose={() => setShowModal(false)}
            onSaved={() => { setShowModal(false); loadMy(); }}
          />
        )}
        {reviewing && (
          <ReviewModal
            request={reviewing.request}
            action={reviewing.action}
            onClose={() => setReviewing(null)}
            onSaved={() => { setReviewing(null); loadAll(); }}
          />
        )}
      </div>
    </Layout>
  );
}
