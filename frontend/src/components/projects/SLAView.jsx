import { useEffect, useState } from 'react';
import { projectsAPI } from '../../services/projectsAPI';
import { toast } from 'sonner';
import { Plus, Trash2, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

const PRIORITY_COLORS = {
  CRITICA: 'text-red-600 bg-red-50 dark:bg-red-900/20',
  ALTA:    'text-orange-600 bg-orange-50 dark:bg-orange-900/20',
  MEDIA:   'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
  BAJA:    'text-slate-600 bg-slate-50 dark:bg-slate-700/50',
};

const EMPTY_POLICY = { priority: 'MEDIA', response_hours: 4, resolution_hours: 24 };

export default function SLAView({ projectId, isManager }) {
  const [policies, setPolicies]   = useState([]);
  const [dashboard, setDashboard] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [form, setForm]           = useState(null);
  const [saving, setSaving]       = useState(false);
  const [view, setView]           = useState('dashboard'); // 'dashboard' | 'policies'

  const load = () => {
    Promise.all([
      projectsAPI.getSLAPolicies(projectId),
      projectsAPI.getSLADashboard(projectId),
    ]).then(([p, d]) => {
      setPolicies(p.data ?? []);
      setDashboard(d.data ?? []);
    }).catch(() => toast.error('Error al cargar SLA'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [projectId]);

  const save = async () => {
    setSaving(true);
    try {
      if (form.id) {
        await projectsAPI.updateSLAPolicy(form.id, form);
      } else {
        await projectsAPI.createSLAPolicy(projectId, form);
      }
      toast.success('Política guardada');
      setForm(null);
      load();
    } catch { toast.error('Error al guardar'); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm('¿Eliminar esta política SLA?')) return;
    try {
      await projectsAPI.deleteSLAPolicy(id);
      toast.success('Política eliminada');
      load();
    } catch { toast.error('Error al eliminar'); }
  };

  if (loading) return <p className="py-10 text-center text-slate-400">Cargando…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-500" /> SLA
          </h2>
          <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 text-xs">
            {['dashboard', 'policies'].map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1 font-medium capitalize transition-colors ${view === v ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                {v === 'dashboard' ? 'Dashboard' : 'Políticas'}
              </button>
            ))}
          </div>
        </div>
        {isManager && view === 'policies' && !form && (
          <button onClick={() => setForm({ ...EMPTY_POLICY })}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
            <Plus size={13} /> Nueva política
          </button>
        )}
      </div>

      {/* Dashboard view */}
      {view === 'dashboard' && (
        <>
          {dashboard.length === 0 ? (
            <div className="py-16 text-center">
              <CheckCircle2 size={32} className="mx-auto text-emerald-300 dark:text-emerald-700 mb-3" />
              <p className="text-slate-500 dark:text-slate-400 text-sm">Sin tareas con SLA asignado o todos cumplen</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                    <th className="text-left py-2 px-3 font-medium">Tarea</th>
                    <th className="text-left py-2 px-3 font-medium">Prioridad</th>
                    <th className="text-left py-2 px-3 font-medium">Respuesta</th>
                    <th className="text-left py-2 px-3 font-medium">Resolución</th>
                    <th className="text-left py-2 px-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {dashboard.map(item => (
                    <tr key={item.task_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="py-2 px-3 text-slate-700 dark:text-slate-200 max-w-xs truncate">{item.task_title}</td>
                      <td className="py-2 px-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PRIORITY_COLORS[item.priority] ?? PRIORITY_COLORS.BAJA}`}>
                          {item.priority}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{item.response_deadline ? item.response_deadline.slice(0, 16) : '—'}</td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{item.resolution_deadline ? item.resolution_deadline.slice(0, 16) : '—'}</td>
                      <td className="py-2 px-3">
                        {item.breached ? (
                          <span className="flex items-center gap-1 text-red-600 text-xs font-semibold"><AlertTriangle size={11} /> Incumplido</span>
                        ) : (
                          <span className="flex items-center gap-1 text-emerald-600 text-xs font-semibold"><CheckCircle2 size={11} /> Ok</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Policies view */}
      {view === 'policies' && (
        <>
          {form && (
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-3 border border-slate-200 dark:border-slate-600">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Prioridad</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                    {['CRITICA','ALTA','MEDIA','BAJA'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Horas de respuesta</label>
                  <input type="number" min="1" value={form.response_hours} onChange={e => setForm(f => ({ ...f, response_hours: e.target.value }))}
                    className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Horas de resolución</label>
                  <input type="number" min="1" value={form.resolution_hours} onChange={e => setForm(f => ({ ...f, resolution_hours: e.target.value }))}
                    className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
              </div>
              <div className="flex gap-2">
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

          {policies.length === 0 && !form ? (
            <div className="py-16 text-center">
              <Clock size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-slate-500 dark:text-slate-400 text-sm">Sin políticas SLA definidas</p>
              {isManager && <button onClick={() => setForm({ ...EMPTY_POLICY })} className="mt-2 text-indigo-600 dark:text-indigo-400 text-xs hover:underline">Crear política</button>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                    <th className="text-left py-2 px-3 font-medium">Prioridad</th>
                    <th className="text-left py-2 px-3 font-medium">Resp. (h)</th>
                    <th className="text-left py-2 px-3 font-medium">Resol. (h)</th>
                    {isManager && <th className="py-2 px-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {policies.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="py-2 px-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PRIORITY_COLORS[p.priority] ?? PRIORITY_COLORS.BAJA}`}>{p.priority}</span>
                      </td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{p.response_hours}h</td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{p.resolution_hours}h</td>
                      {isManager && (
                        <td className="py-2 px-3 text-right">
                          <button onClick={() => setForm({ ...p })} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mr-3">Editar</button>
                          <button onClick={() => remove(p.id)} className="text-xs text-red-500 hover:underline"><Trash2 size={11} className="inline" /></button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
