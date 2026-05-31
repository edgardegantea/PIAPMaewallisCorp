import { useEffect, useState } from 'react';
import { projectsAPI } from '../../services/projectsAPI';
import { toast } from 'sonner';
import { Plus, Trash2, Edit2, LayoutGrid, GripVertical } from 'lucide-react';

const BASE_STATUSES = ['PENDIENTE','EN_PROGRESO','BLOQUEADA','COMPLETADA'];
const COLORS = ['#6366f1','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#94a3b8'];

const EMPTY = { name: '', color: '#6366f1', maps_to: 'PENDIENTE', position: 0 };

export default function ProjectStatusesView({ projectId, isManager }) {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [form, setForm]         = useState(null);
  const [editId, setEditId]     = useState(null);
  const [saving, setSaving]     = useState(false);

  const load = () => {
    projectsAPI.getProjectStatuses(projectId)
      .then(r => setStatuses(r.data ?? []))
      .catch(() => toast.error('Error al cargar estados'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [projectId]);

  const save = async () => {
    if (!form.name.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      if (editId) {
        await projectsAPI.updateProjectStatus(editId, form);
        toast.success('Estado actualizado');
      } else {
        await projectsAPI.createProjectStatus(projectId, { ...form, position: statuses.length });
        toast.success('Estado creado');
      }
      setForm(null);
      setEditId(null);
      load();
    } catch { toast.error('Error al guardar'); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm('¿Eliminar este estado personalizado?')) return;
    try {
      await projectsAPI.deleteProjectStatus(id);
      toast.success('Estado eliminado');
      load();
    } catch { toast.error('Error al eliminar'); }
  };

  const startEdit = (s) => {
    setEditId(s.id);
    setForm({ name: s.name, color: s.color || '#6366f1', maps_to: s.maps_to || 'PENDIENTE', position: s.position ?? 0 });
  };

  if (loading) return <p className="py-10 text-center text-slate-400">Cargando…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <LayoutGrid size={15} className="text-indigo-500" /> Estados del Tablero Kanban
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Personaliza las columnas del tablero para este proyecto</p>
        </div>
        {isManager && !form && (
          <button onClick={() => { setForm({ ...EMPTY }); setEditId(null); }}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
            <Plus size={13} /> Nuevo estado
          </button>
        )}
      </div>

      {/* Info banner */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
        Los estados personalizados se mapean a los estados base del sistema (<strong>Pendiente, En Progreso, Bloqueada, Completada</strong>) para mantener la compatibilidad con métricas y reportes.
      </div>

      {/* Form */}
      {form && (
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-3 border border-slate-200 dark:border-slate-600">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Nombre del estado</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="ej: En QA, En diseño…"
                className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Mapea a</label>
              <select value={form.maps_to} onChange={e => setForm(f => ({ ...f, maps_to: e.target.value }))}
                className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                {BASE_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
                <div className="flex gap-1 flex-wrap">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                      style={{ backgroundColor: c }}
                      className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${form.color === c ? 'ring-2 ring-offset-1 ring-slate-500' : ''}`} />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
              {saving ? 'Guardando…' : (editId ? 'Actualizar' : 'Crear estado')}
            </button>
            <button onClick={() => { setForm(null); setEditId(null); }}
              className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Statuses list */}
      {statuses.length === 0 && !form ? (
        <div className="py-12 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
          <LayoutGrid size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">Sin estados personalizados</p>
          <p className="text-xs text-slate-400 mt-1">El tablero usa los 4 estados predeterminados del sistema</p>
          {isManager && <button onClick={() => setForm({ ...EMPTY })} className="mt-3 text-indigo-600 dark:text-indigo-400 text-xs hover:underline">Crear primer estado</button>}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Preview */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {statuses.map(s => (
              <div key={s.id} className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold"
                style={{ backgroundColor: s.color || '#6366f1' }}>
                {s.name}
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                  <th className="text-left py-2 px-3 font-medium">Estado</th>
                  <th className="text-left py-2 px-3 font-medium">Color</th>
                  <th className="text-left py-2 px-3 font-medium">Mapea a</th>
                  {isManager && <th className="py-2 px-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {statuses.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color || '#6366f1' }} />
                        <span className="font-medium text-slate-800 dark:text-slate-100">{s.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <code className="text-xs text-slate-500 dark:text-slate-400">{s.color}</code>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
                        {s.maps_to?.replace('_', ' ')}
                      </span>
                    </td>
                    {isManager && (
                      <td className="py-2.5 px-3 text-right">
                        <button onClick={() => startEdit(s)} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mr-3">
                          <Edit2 size={11} className="inline mr-0.5" /> Editar
                        </button>
                        <button onClick={() => remove(s.id)} className="text-xs text-red-500 hover:underline">
                          <Trash2 size={11} className="inline" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
