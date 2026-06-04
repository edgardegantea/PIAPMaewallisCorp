import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash2, X, Save, Download,
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  DollarSign, Briefcase,
} from 'lucide-react';
import { budgetAPI } from '../../services/attendanceAPI';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = {
  materiales: { label: 'Materiales',   color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'    },
  mano_obra:  { label: 'Mano de obra', color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' },
  equipos:    { label: 'Equipos',      color: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400' },
  servicios:  { label: 'Servicios',    color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'},
  viajes:     { label: 'Viajes',       color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'  },
  otros:      { label: 'Otros',        color: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'    },
};

function fmt(n) {
  return Number(n ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(a, b) {
  if (!b || b <= 0) return 0;
  return Math.round((a / b) * 100);
}

function exportCSV(items, projectId) {
  const cols = ['ID','Categoría','Descripción','Planificado','Real','Fecha','Notas'];
  const lines = [cols.join(',')];
  items.forEach(i => {
    lines.push([
      i.id, CATEGORIES[i.category]?.label ?? i.category,
      `"${i.description.replace(/"/g,'""')}"`,
      i.planned_amount, i.actual_amount,
      i.date ?? '',
      `"${(i.notes ?? '').replace(/"/g,'""')}"`,
    ].join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `presupuesto_proyecto_${projectId}.csv`;
  a.click();
}

// ─────────────────────────────────────────────────────────────────────────────
// Item modal
// ─────────────────────────────────────────────────────────────────────────────

function ItemModal({ item, projectId, onClose, onSaved }) {
  const isNew = !item?.id;
  const [form, setForm] = useState({
    category:       item?.category       ?? 'otros',
    description:    item?.description    ?? '',
    planned_amount: item?.planned_amount ?? '',
    actual_amount:  item?.actual_amount  ?? '',
    date:           item?.date           ?? '',
    notes:          item?.notes          ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const inp = 'w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400';

  const submit = async e => {
    e.preventDefault();
    if (!form.description.trim()) { toast.error('Descripción requerida'); return; }
    setSaving(true);
    try {
      isNew
        ? await budgetAPI.create(projectId, form)
        : await budgetAPI.update(item.id, form);
      toast.success(isNew ? 'Partida agregada' : 'Partida actualizada');
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
            {isNew ? 'Nueva partida presupuestal' : 'Editar partida'}
          </h2>
          <button onClick={onClose}><X size={18} className="text-slate-400"/></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Categoría</label>
            <select className={inp} value={form.category} onChange={e => set('category', e.target.value)}>
              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Descripción *</label>
            <input className={inp} value={form.description} onChange={e => set('description', e.target.value)} required placeholder="Ej. Compra de equipos de cómputo"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Planificado ($)</label>
              <input className={inp} type="number" step="0.01" min="0" value={form.planned_amount} onChange={e => set('planned_amount', e.target.value)} placeholder="0.00"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Real ($)</label>
              <input className={inp} type="number" step="0.01" min="0" value={form.actual_amount} onChange={e => set('actual_amount', e.target.value)} placeholder="0.00"/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Fecha</label>
            <input className={inp} type="date" value={form.date} onChange={e => set('date', e.target.value)}/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Notas</label>
            <textarea className={`${inp} h-20 resize-none`} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Observaciones adicionales..."/>
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
// BudgetView
// ─────────────────────────────────────────────────────────────────────────────

export default function BudgetView({ projectId, isManager }) {
  const [data,        setData]       = useState(null);
  const [loading,     setLoading]    = useState(true);
  const [editItem,    setEditItem]   = useState(null);
  const [showModal,   setShowModal]  = useState(false);
  const [filterCat,   setFilterCat]  = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await budgetAPI.get(projectId); setData(data); }
    catch { toast.error('Error al cargar presupuesto'); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta partida?')) return;
    try { await budgetAPI.delete(id); toast.success('Partida eliminada'); load(); }
    catch { toast.error('Error al eliminar'); }
  };

  if (loading) return <p className="text-sm text-slate-400 animate-pulse py-4">Cargando presupuesto...</p>;
  if (!data)   return null;

  const items    = data.items ?? [];
  const summary  = data.summary ?? [];
  const proj     = data.project ?? {};

  const totalPlanned  = items.reduce((s, i) => s + parseFloat(i.planned_amount ?? 0), 0);
  const totalActual   = items.reduce((s, i) => s + parseFloat(i.actual_amount  ?? 0), 0);
  const deviation     = totalActual - totalPlanned;
  const usagePct      = pct(totalActual, totalPlanned);
  const isOverBudget  = deviation > 0 && totalPlanned > 0;

  const filtered = filterCat ? items.filter(i => i.category === filterCat) : items;

  // Group by category for the summary chart
  const catMap = {};
  summary.forEach(s => { catMap[s.category] = s; });

  return (
    <div className="space-y-6">

      {/* ── KPI cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Presupuesto planificado', value: `$${fmt(totalPlanned)}`, icon: Briefcase, color: 'indigo' },
          { label: 'Gasto real',              value: `$${fmt(totalActual)}`,  icon: DollarSign, color: totalActual > totalPlanned ? 'red' : 'emerald' },
          { label: 'Variación',               value: `${deviation >= 0 ? '+' : ''}$${fmt(deviation)}`, icon: deviation > 0 ? TrendingUp : TrendingDown, color: isOverBudget ? 'red' : 'emerald' },
          { label: '% Ejecutado',             value: `${usagePct}%`, icon: usagePct > 100 ? AlertTriangle : CheckCircle2, color: usagePct > 100 ? 'red' : usagePct > 80 ? 'amber' : 'emerald' },
        ].map(({ label, value, icon: Icon, color }) => {
          const colors = {
            indigo:  'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
            emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
            red:     'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
            amber:   'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
          };
          return (
            <div key={label} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4 flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${colors[color]} flex-shrink-0`}><Icon size={18}/></div>
              <div>
                <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Budget bar ──────────────────────────────────────────────────── */}
      {totalPlanned > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Ejecución presupuestal</span>
            <span className={`text-sm font-bold ${isOverBudget ? 'text-red-600' : 'text-emerald-600'}`}>{usagePct}%</span>
          </div>
          <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${isOverBudget ? 'bg-red-500' : usagePct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, usagePct)}%` }}/>
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>$0</span><span>Planificado: ${fmt(totalPlanned)}</span>
          </div>
        </div>
      )}

      {/* ── Summary by category ─────────────────────────────────────────── */}
      {summary.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Resumen por categoría</h3>
          </div>
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/50">
                  {['Categoría','Partidas','Planificado','Real','Variación','%'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {summary.map(s => {
                  const dev = parseFloat(s.actual) - parseFloat(s.planned);
                  const p   = pct(s.actual, s.planned);
                  return (
                    <tr key={s.category} className="bg-white dark:bg-slate-800">
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORIES[s.category]?.color ?? ''}`}>
                          {CATEGORIES[s.category]?.label ?? s.category}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-500">{s.items}</td>
                      <td className="px-3 py-2.5 font-mono">${fmt(s.planned)}</td>
                      <td className="px-3 py-2.5 font-mono">${fmt(s.actual)}</td>
                      <td className={`px-3 py-2.5 font-mono ${dev > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                        {dev >= 0 ? '+' : ''}${fmt(dev)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`font-semibold ${p > 100 ? 'text-red-500' : p > 80 ? 'text-amber-500' : 'text-emerald-600'}`}>{p}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Items list ──────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Partidas presupuestales</h3>
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
              className="border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 text-xs bg-white dark:bg-slate-700 dark:text-slate-100">
              <option value="">Todas las categorías</option>
              {Object.entries(CATEGORIES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            {isManager && (
              <button onClick={() => { setEditItem({}); setShowModal(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
                <Plus size={12}/> Agregar partida
              </button>
            )}
            <button onClick={() => exportCSV(items, projectId)} disabled={items.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors">
              <Download size={12}/> CSV
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <DollarSign size={28} className="text-slate-300 dark:text-slate-600 mx-auto mb-2"/>
            <p className="text-slate-500 text-sm">
              {filterCat ? 'Sin partidas en esta categoría.' : 'Aún no hay partidas presupuestales.'}
            </p>
            {isManager && !filterCat && (
              <button onClick={() => { setEditItem({}); setShowModal(true); }}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
                <Plus size={13}/> Agregar primera partida
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/50">
                  {['Categoría','Descripción','Planificado','Real','Variación','Fecha',''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.map(item => {
                  const dev = parseFloat(item.actual_amount) - parseFloat(item.planned_amount);
                  return (
                    <tr key={item.id} className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORIES[item.category]?.color ?? ''}`}>
                          {CATEGORIES[item.category]?.label ?? item.category}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800 dark:text-slate-100">{item.description}</p>
                        {item.notes && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{item.notes}</p>}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">${fmt(item.planned_amount)}</td>
                      <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">${fmt(item.actual_amount)}</td>
                      <td className={`px-4 py-3 font-mono font-medium ${dev > 0 ? 'text-red-500' : dev < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {dev !== 0 ? (dev > 0 ? '+' : '') + '$' + fmt(dev) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{item.date ?? '—'}</td>
                      <td className="px-4 py-3">
                        {isManager && (
                          <div className="flex gap-1">
                            <button onClick={() => { setEditItem(item); setShowModal(true); }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
                              <Pencil size={13}/>
                            </button>
                            <button onClick={() => handleDelete(item.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                              <Trash2 size={13}/>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 dark:bg-slate-700/50 font-semibold">
                  <td colSpan={2} className="px-4 py-3 text-xs uppercase tracking-wide text-slate-500">Total</td>
                  <td className="px-4 py-3 font-mono text-slate-800 dark:text-slate-100">${fmt(totalPlanned)}</td>
                  <td className="px-4 py-3 font-mono text-slate-800 dark:text-slate-100">${fmt(totalActual)}</td>
                  <td className={`px-4 py-3 font-mono ${deviation > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {deviation >= 0 ? '+' : ''}${fmt(deviation)}
                  </td>
                  <td colSpan={2}/>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <ItemModal
          item={editItem}
          projectId={projectId}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}
