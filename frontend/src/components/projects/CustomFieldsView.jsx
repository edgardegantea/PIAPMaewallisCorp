import { useEffect, useState } from 'react';
import { projectsAPI } from '../../services/projectsAPI';
import { toast } from 'sonner';
import { Plus, Trash2, Edit2, Sliders, Check, X } from 'lucide-react';

const FIELD_TYPES = [
  { value: 'text',     label: 'Texto' },
  { value: 'number',   label: 'Número' },
  { value: 'date',     label: 'Fecha' },
  { value: 'dropdown', label: 'Desplegable' },
  { value: 'user',     label: 'Usuario' },
  { value: 'url',      label: 'URL' },
  { value: 'checkbox', label: 'Casilla' },
];

const EMPTY = { name: '', field_type: 'text', options: '', is_required: false, default_value: '' };

export default function CustomFieldsView({ projectId, isManager }) {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState(null);
  const [editId, setEditId]   = useState(null);
  const [saving, setSaving]   = useState(false);

  const load = () => {
    projectsAPI.getCustomFields(projectId)
      .then(r => setFields(r.data ?? []))
      .catch(() => toast.error('Error al cargar campos'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [projectId]);

  const save = async () => {
    if (!form.name.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        options: form.field_type === 'dropdown' && form.options
          ? form.options.split('\n').map(s => s.trim()).filter(Boolean)
          : [],
      };
      if (editId) {
        await projectsAPI.updateCustomField(editId, payload);
        toast.success('Campo actualizado');
      } else {
        await projectsAPI.createCustomField(projectId, payload);
        toast.success('Campo creado');
      }
      setForm(null);
      setEditId(null);
      load();
    } catch { toast.error('Error al guardar'); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm('¿Eliminar este campo personalizado? Se perderán todos los valores asignados.')) return;
    try {
      await projectsAPI.deleteCustomField(id);
      toast.success('Campo eliminado');
      load();
    } catch { toast.error('Error al eliminar'); }
  };

  const startEdit = (f) => {
    setEditId(f.id);
    setForm({
      name: f.name,
      field_type: f.field_type,
      options: Array.isArray(f.options) ? f.options.join('\n') : (f.options || ''),
      is_required: !!f.is_required,
      default_value: f.default_value || '',
    });
  };

  const typeLabel = (t) => FIELD_TYPES.find(x => x.value === t)?.label ?? t;

  if (loading) return <p className="py-10 text-center text-slate-400">Cargando…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <Sliders size={15} className="text-indigo-500" /> Campos Personalizados
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Estos campos aparecerán en las tareas de este proyecto</p>
        </div>
        {isManager && !form && (
          <button onClick={() => { setForm({ ...EMPTY }); setEditId(null); }}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
            <Plus size={13} /> Nuevo campo
          </button>
        )}
      </div>

      {/* Form */}
      {form && (
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-3 border border-slate-200 dark:border-slate-600">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Nombre del campo</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="ej: Área de negocio"
                className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Tipo</label>
              <select value={form.field_type} onChange={e => setForm(f => ({ ...f, field_type: e.target.value }))}
                className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            {form.field_type === 'dropdown' && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Opciones <span className="text-slate-400 font-normal">(una por línea)</span>
                </label>
                <textarea rows={4} value={form.options} onChange={e => setForm(f => ({ ...f, options: e.target.value }))}
                  placeholder={"Opción 1\nOpción 2\nOpción 3"}
                  className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
            )}
            {!['checkbox','user'].includes(form.field_type) && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Valor por defecto</label>
                <input type="text" value={form.default_value} onChange={e => setForm(f => ({ ...f, default_value: e.target.value }))}
                  className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
            )}
            <div className="flex items-center gap-2 self-end pb-2">
              <input type="checkbox" id="is_required" checked={!!form.is_required} onChange={e => setForm(f => ({ ...f, is_required: e.target.checked }))}
                className="accent-indigo-600" />
              <label htmlFor="is_required" className="text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">Campo obligatorio</label>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
              {saving ? 'Guardando…' : (editId ? 'Actualizar' : 'Crear campo')}
            </button>
            <button onClick={() => { setForm(null); setEditId(null); }}
              className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Fields list */}
      {fields.length === 0 && !form ? (
        <div className="py-16 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
          <Sliders size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">Sin campos personalizados</p>
          <p className="text-xs text-slate-400 mt-1">Añade campos para capturar información específica de tus tareas</p>
          {isManager && <button onClick={() => setForm({ ...EMPTY })} className="mt-3 text-indigo-600 dark:text-indigo-400 text-xs hover:underline">Crear primer campo</button>}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                <th className="text-left py-2 px-3 font-medium">Nombre</th>
                <th className="text-left py-2 px-3 font-medium">Tipo</th>
                <th className="text-left py-2 px-3 font-medium">Opciones</th>
                <th className="text-left py-2 px-3 font-medium">Obligatorio</th>
                {isManager && <th className="py-2 px-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {fields.map(f => (
                <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-100">{f.name}</td>
                  <td className="py-2.5 px-3">
                    <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">{typeLabel(f.field_type)}</span>
                  </td>
                  <td className="py-2.5 px-3 text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">
                    {Array.isArray(f.options) && f.options.length > 0
                      ? f.options.join(', ')
                      : f.default_value || '—'}
                  </td>
                  <td className="py-2.5 px-3">
                    {f.is_required
                      ? <Check size={13} className="text-emerald-500" />
                      : <X size={13} className="text-slate-300" />}
                  </td>
                  {isManager && (
                    <td className="py-2.5 px-3 text-right">
                      <button onClick={() => startEdit(f)} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mr-3">
                        <Edit2 size={12} className="inline mr-0.5" /> Editar
                      </button>
                      <button onClick={() => remove(f.id)} className="text-xs text-red-500 hover:underline">
                        <Trash2 size={12} className="inline" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
