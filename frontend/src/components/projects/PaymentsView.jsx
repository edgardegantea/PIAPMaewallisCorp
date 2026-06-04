import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash2, X, Save, CheckCircle2,
  Clock, AlertTriangle, DollarSign, Calendar, Link as LinkIcon,
} from 'lucide-react';
import { paymentsAPI } from '../../services/attendanceAPI';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(n) {
  return Number(n ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T12:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS = {
  pendiente: { label: 'Pendiente', cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400', icon: Clock       },
  pagado:    { label: 'Pagado',    cls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400', icon: CheckCircle2 },
  atrasado:  { label: 'Atrasado',  cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',       icon: AlertTriangle },
  cancelado: { label: 'Cancelado', cls: 'bg-slate-100 dark:bg-slate-700 text-slate-500',                      icon: X            },
};

// ─────────────────────────────────────────────────────────────────────────────
// Payment modal
// ─────────────────────────────────────────────────────────────────────────────

function PaymentModal({ payment, projectId, milestones, onClose, onSaved }) {
  const isNew = !payment?.id;
  const [form, setForm] = useState({
    concept:      payment?.concept      ?? '',
    amount:       payment?.amount       ?? '',
    due_date:     payment?.due_date     ?? '',
    milestone_id: payment?.milestone_id ?? '',
    notes:        payment?.notes        ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const inp = 'w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400';

  const submit = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      isNew
        ? await paymentsAPI.create(projectId, form)
        : await paymentsAPI.update(payment.id, form);
      toast.success(isNew ? 'Pago agregado' : 'Pago actualizado');
      onSaved();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <DollarSign size={16} className="text-indigo-500"/>
            {isNew ? 'Nuevo pago programado' : 'Editar pago'}
          </h2>
          <button onClick={onClose}><X size={18} className="text-slate-400"/></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Concepto *</label>
            <input className={inp} value={form.concept} onChange={e => set('concept', e.target.value)} required placeholder="Ej. Anticipo — 30%"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Monto ($) *</label>
              <input className={inp} type="number" step="0.01" min="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} required placeholder="0.00"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Fecha de vencimiento *</label>
              <input className={inp} type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} required/>
            </div>
          </div>
          {milestones?.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Hito vinculado</label>
              <select className={inp} value={form.milestone_id} onChange={e => set('milestone_id', e.target.value)}>
                <option value="">— Sin hito —</option>
                {milestones.map(m => <option key={m.id} value={m.id}>{m.title}{m.due_date ? ` (${fmtDate(m.due_date)})` : ''}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Notas</label>
            <textarea className={`${inp} h-20 resize-none`} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Condiciones, banco, referencia..."/>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-2 disabled:opacity-60 transition-colors">
              <Save size={14}/> {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PaymentsView
// ─────────────────────────────────────────────────────────────────────────────

export default function PaymentsView({ projectId, isManager }) {
  const [data,       setData]      = useState(null);
  const [loading,    setLoading]   = useState(true);
  const [editPayment,setEditPayment]= useState(null);
  const [showModal,  setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await paymentsAPI.get(projectId); setData(data); }
    catch { toast.error('Error al cargar cronograma de pagos'); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleMarkPaid = async (id) => {
    const date = prompt('Fecha de pago (YYYY-MM-DD):', new Date().toISOString().slice(0, 10));
    if (!date) return;
    try { await paymentsAPI.markPaid(id, { paid_at: date }); toast.success('Pago registrado'); load(); }
    catch (err) { toast.error(err.response?.data?.message ?? 'Error'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este pago programado?')) return;
    try { await paymentsAPI.delete(id); toast.success('Eliminado'); load(); }
    catch { toast.error('Error al eliminar'); }
  };

  if (loading) return <p className="text-sm text-slate-400 animate-pulse py-4">Cargando cronograma...</p>;
  if (!data)   return null;

  const { payments = [], summary = {}, milestones = [] } = data;
  const totalPct = summary.total > 0 ? Math.round((summary.pagado / summary.total) * 100) : 0;

  return (
    <div className="space-y-6">

      {/* ── Summary cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Total programado', value: `$${fmt(summary.total)}`,     color: 'indigo'  },
          { label: 'Cobrado / Pagado', value: `$${fmt(summary.pagado)}`,    color: 'emerald' },
          { label: 'Pendiente',        value: `$${fmt(summary.pendiente)}`, color: 'amber'   },
          { label: 'Atrasado',         value: `$${fmt(summary.atrasado)}`,  color: 'red'     },
        ].map(({ label, value, color }) => {
          const colors = {
            indigo: 'text-indigo-600 dark:text-indigo-400',
            emerald:'text-emerald-600 dark:text-emerald-400',
            amber:  'text-amber-600 dark:text-amber-400',
            red:    'text-red-600 dark:text-red-400',
          };
          return (
            <div key={label} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4">
              <p className={`text-xl font-bold ${colors[color]}`}>{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          );
        })}
      </div>

      {/* ── Progress bar ─────────────────────────────────────────────────── */}
      {summary.total > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 px-6 py-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-slate-700 dark:text-slate-200">Cobrado</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400">{totalPct}%</span>
          </div>
          <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${totalPct}%` }}/>
          </div>
          <p className="text-xs text-slate-400 mt-1">{summary.pagado_count ?? 0} de {summary.total_count ?? 0} pagos completados</p>
        </div>
      )}

      {/* ── Timeline ─────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Cronograma de pagos</h3>
          {isManager && (
            <button onClick={() => { setEditPayment({}); setShowModal(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
              <Plus size={12}/> Agregar pago
            </button>
          )}
        </div>

        {payments.length === 0 ? (
          <div className="py-12 text-center">
            <Calendar size={28} className="text-slate-300 dark:text-slate-600 mx-auto mb-2"/>
            <p className="text-slate-500 text-sm">Sin pagos programados.</p>
            {isManager && (
              <button onClick={() => { setEditPayment({}); setShowModal(true); }}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
                <Plus size={13}/> Programar primer pago
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {payments.map((p, i) => {
              const st     = STATUS[p.status] ?? STATUS.pendiente;
              const StIcon = st.icon;
              return (
                <div key={p.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${st.cls}`}>
                      <StIcon size={14}/>
                    </div>
                    {i < payments.length - 1 && <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mt-1"/>}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-slate-800 dark:text-slate-100">{p.concept}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span>
                      {p.milestone_title && (
                        <span className="flex items-center gap-1 text-xs text-indigo-500">
                          <LinkIcon size={10}/> {p.milestone_title}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                      <span>Vence: {fmtDate(p.due_date)}</span>
                      {p.paid_at && <span className="text-emerald-600">Pagado: {fmtDate(p.paid_at)}</span>}
                    </div>
                    {p.notes && <p className="text-xs text-slate-400 mt-0.5 truncate">{p.notes}</p>}
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">${fmt(p.amount)}</span>
                    {isManager && (
                      <div className="flex gap-1">
                        {p.status !== 'pagado' && p.status !== 'cancelado' && (
                          <button onClick={() => handleMarkPaid(p.id)} title="Marcar como pagado"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                            <CheckCircle2 size={14}/>
                          </button>
                        )}
                        <button onClick={() => { setEditPayment(p); setShowModal(true); }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
                          <Pencil size={13}/>
                        </button>
                        <button onClick={() => handleDelete(p.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <PaymentModal
          payment={editPayment}
          projectId={projectId}
          milestones={milestones}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}
