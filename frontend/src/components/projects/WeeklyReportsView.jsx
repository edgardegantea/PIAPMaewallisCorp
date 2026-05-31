import { useEffect, useState } from 'react';
import { projectsAPI } from '../../services/projectsAPI';
import { toast } from 'sonner';
import { Plus, Trash2, ChevronDown, ChevronUp, Calendar, TrendingUp } from 'lucide-react';

const RAG_COLORS = {
  GREEN:  { bg: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', label: 'Verde' },
  AMBER:  { bg: 'bg-amber-100  text-amber-700',   dot: 'bg-amber-500',   label: 'Ámbar' },
  RED:    { bg: 'bg-red-100    text-red-700',      dot: 'bg-red-500',     label: 'Rojo'  },
};

const EMPTY = { rag_status: 'GREEN', summary: '', highlights: '', blockers: '', next_week_plan: '', metrics_snapshot: '' };

export default function WeeklyReportsView({ projectId, isManager }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    projectsAPI.getWeeklyReports(projectId)
      .then(r => setReports(r.data ?? []))
      .catch(() => toast.error('Error al cargar reportes'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [projectId]);

  const save = async () => {
    if (!form.summary.trim()) { toast.error('El resumen es obligatorio'); return; }
    setSaving(true);
    try {
      if (form.id) {
        await projectsAPI.updateWeeklyReport(form.id, form);
      } else {
        await projectsAPI.createWeeklyReport(projectId, form);
      }
      toast.success('Reporte guardado');
      setForm(null);
      load();
    } catch { toast.error('Error al guardar'); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm('¿Eliminar este reporte?')) return;
    try {
      await projectsAPI.deleteWeeklyReport(id);
      toast.success('Reporte eliminado');
      load();
    } catch { toast.error('Error al eliminar'); }
  };

  if (loading) return <p className="py-10 text-center text-slate-400">Cargando…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
          <TrendingUp size={15} className="text-indigo-500" /> Reportes Semanales
        </h2>
        {isManager && !form && (
          <button
            onClick={() => setForm({ ...EMPTY })}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
            <Plus size={13} /> Nuevo reporte
          </button>
        )}
      </div>

      {/* Form */}
      {form && (
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-3 border border-slate-200 dark:border-slate-600">
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300 w-24">Estado RAG</label>
            <div className="flex gap-2">
              {Object.entries(RAG_COLORS).map(([k, v]) => (
                <button key={k} onClick={() => setForm(f => ({ ...f, rag_status: k }))}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border-2 transition-all ${v.bg} ${form.rag_status === k ? 'border-slate-400' : 'border-transparent opacity-60'}`}>
                  <span className={`w-2 h-2 rounded-full ${v.dot}`} /> {v.label}
                </button>
              ))}
            </div>
          </div>
          {[
            { field: 'summary',       label: 'Resumen',          rows: 3 },
            { field: 'highlights',    label: 'Logros clave',     rows: 2 },
            { field: 'blockers',      label: 'Bloqueos',         rows: 2 },
            { field: 'next_week_plan',label: 'Plan próx. semana',rows: 2 },
          ].map(({ field, label, rows }) => (
            <div key={field}>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">{label}</label>
              <textarea rows={rows} value={form[field] || ''} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={() => setForm(null)}
              className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {reports.length === 0 && !form ? (
        <div className="py-16 text-center">
          <Calendar size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">Sin reportes aún</p>
          {isManager && <button onClick={() => setForm({ ...EMPTY })} className="mt-2 text-indigo-600 dark:text-indigo-400 text-xs hover:underline">Crear el primero</button>}
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map(r => {
            const rag = RAG_COLORS[r.rag_status] ?? RAG_COLORS.GREEN;
            const open = expanded === r.id;
            return (
              <div key={r.id} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <button className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
                  onClick={() => setExpanded(open ? null : r.id)}>
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${rag.dot}`} />
                  <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{r.summary?.slice(0, 80) || '(sin resumen)'}</span>
                  <span className="text-xs text-slate-400 flex-shrink-0">{r.week_start ?? r.created_at?.slice(0, 10)}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${rag.bg}`}>{rag.label}</span>
                  {open ? <ChevronUp size={14} className="text-slate-400 flex-shrink-0" /> : <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />}
                </button>

                {open && (
                  <div className="px-4 pb-4 pt-2 bg-slate-50 dark:bg-slate-700/30 space-y-3">
                    {[
                      ['Resumen', r.summary],
                      ['Logros clave', r.highlights],
                      ['Bloqueos', r.blockers],
                      ['Plan próx. semana', r.next_week_plan],
                    ].map(([label, val]) => val ? (
                      <div key={label}>
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
                        <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line">{val}</p>
                      </div>
                    ) : null)}
                    {isManager && (
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => { setForm({ ...r }); setExpanded(null); }}
                          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">Editar</button>
                        <button onClick={() => remove(r.id)}
                          className="text-xs text-red-500 hover:underline flex items-center gap-1">
                          <Trash2 size={11} /> Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
