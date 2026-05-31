import { useEffect, useState } from 'react';
import { projectsAPI } from '../../services/projectsAPI';
import { toast } from 'sonner';
import { Zap, Plus, Trash2, Power, PowerOff, ChevronDown, ChevronUp, Loader2, X, Check } from 'lucide-react';

const TRIGGER_LABELS = {
  'task.created': 'Tarea creada', 'task.status_changed': 'Estado cambiado',
  'task.assigned': 'Tarea asignada', 'task.due_date.passed': 'Fecha límite pasada',
  'task.completed': 'Tarea completada', 'sprint.started': 'Sprint iniciado',
  'sprint.completed': 'Sprint completado', 'risk.created': 'Riesgo creado',
  'member.added': 'Miembro agregado',
};
const ACTION_LABELS = {
  'set_status': 'Cambiar estado', 'set_assignee': 'Asignar a',
  'set_priority': 'Cambiar prioridad', 'set_label': 'Agregar etiqueta',
  'move_to_sprint': 'Mover a sprint', 'add_comment': 'Agregar comentario',
  'send_notification': 'Enviar notificación', 'trigger_webhook': 'Disparar webhook',
};
const STATUS_OPTIONS = ['PENDIENTE','EN_PROGRESO','BLOQUEADA','COMPLETADA'];
const PRIORITY_OPTIONS = ['BAJA','MEDIA','ALTA','CRITICA'];

const inputCls = 'w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500';

function ActionBuilder({ action, onChange, onRemove }) {
  return (
    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700/40 rounded-lg p-2">
      <select value={action.type} onChange={e => onChange({ ...action, type: e.target.value, value: '' })}
        className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-xs bg-white dark:bg-slate-700 dark:text-slate-100 flex-shrink-0">
        {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      {['set_status'].includes(action.type) && (
        <select value={action.value || ''} onChange={e => onChange({ ...action, value: e.target.value })}
          className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-xs bg-white dark:bg-slate-700 dark:text-slate-100 flex-1">
          <option value="">Seleccionar…</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      )}
      {['set_priority'].includes(action.type) && (
        <select value={action.value || ''} onChange={e => onChange({ ...action, value: e.target.value })}
          className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-xs bg-white dark:bg-slate-700 dark:text-slate-100 flex-1">
          <option value="">Seleccionar…</option>
          {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      )}
      {['add_comment','send_notification'].includes(action.type) && (
        <input value={action.value || ''} onChange={e => onChange({ ...action, value: e.target.value })}
          placeholder="Mensaje…" className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-xs bg-white dark:bg-slate-700 dark:text-slate-100 flex-1"/>
      )}
      <button onClick={onRemove} className="text-slate-400 hover:text-red-500 flex-shrink-0"><X size={13}/></button>
    </div>
  );
}

export default function AutomationsView({ projectId, isManager }) {
  const [rules, setRules] = useState([]);
  const [meta,  setMeta]  = useState({ triggers: [], actions: [] });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', trigger_event: 'task.status_changed', actions: [{ type: 'set_status', value: '' }] });
  const [saving, setSaving] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState(null);
  const [logs, setLogs] = useState([]);

  const load = () => Promise.all([
    projectsAPI.getAutomations(projectId).then(r => setRules(r.data)),
    projectsAPI.getAutomationMeta().then(r => setMeta(r.data)),
  ]).catch(() => {}).finally(() => setLoading(false));

  useEffect(() => { load(); }, [projectId]);

  const addAction = () => setForm(f => ({ ...f, actions: [...f.actions, { type: 'set_status', value: '' }] }));
  const updateAction = (i, a) => setForm(f => { const actions = [...f.actions]; actions[i] = a; return { ...f, actions }; });
  const removeAction = (i) => setForm(f => ({ ...f, actions: f.actions.filter((_, j) => j !== i) }));

  const save = async (e) => {
    e.preventDefault();
    if (!form.name || !form.actions.length) return toast.error('Nombre y al menos una acción requeridos');
    setSaving(true);
    try {
      await projectsAPI.createAutomation(projectId, form);
      toast.success('Automatización creada');
      setShowForm(false);
      setForm({ name: '', trigger_event: 'task.status_changed', actions: [{ type: 'set_status', value: '' }] });
      load();
    } catch { toast.error('Error al crear automatización'); }
    finally { setSaving(false); }
  };

  const toggle = async (id) => {
    await projectsAPI.toggleAutomation(id);
    setRules(rules.map(r => r.id === id ? { ...r, is_active: r.is_active ? 0 : 1 } : r));
  };
  const del = async (id) => { await projectsAPI.deleteAutomation(id); load(); };
  const viewLogs = async (id) => {
    if (expandedLogs === id) { setExpandedLogs(null); return; }
    const r = await projectsAPI.getAutomationLogs(id);
    setLogs(r.data); setExpandedLogs(id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-indigo-500"/>
          <h3 className="font-semibold text-slate-700 dark:text-slate-200">Reglas de automatización</h3>
        </div>
        {isManager && <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"><Plus size={14}/> Nueva regla</button>}
      </div>

      {showForm && (
        <form onSubmit={save} className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-indigo-200 dark:border-indigo-800 space-y-4">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Nueva automatización</h4>
          <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre de la regla *" className={inputCls}/>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Cuando ocurre</label>
            <select value={form.trigger_event} onChange={e => setForm(f => ({ ...f, trigger_event: e.target.value }))} className={inputCls}>
              {Object.entries(TRIGGER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Entonces</label>
            <div className="space-y-2">
              {form.actions.map((a, i) => <ActionBuilder key={i} action={a} onChange={act => updateAction(i, act)} onRemove={() => removeAction(i)}/>)}
              <button type="button" onClick={addAction} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"><Plus size={12}/> Agregar acción</button>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-slate-500 px-3 py-2 hover:text-slate-700">Cancelar</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50 transition-colors">
              {saving && <Loader2 size={13} className="animate-spin"/>} Guardar regla
            </button>
          </div>
        </form>
      )}

      {loading ? <div className="text-center py-12 text-slate-400">Cargando…</div> :
      rules.length === 0 ? (
        <div className="text-center py-12 text-slate-400"><Zap size={36} className="mx-auto mb-3 opacity-30"/><p>Sin automatizaciones. Crea reglas para ahorrar trabajo manual.</p></div>
      ) : (
        <div className="space-y-3">
          {rules.map(r => (
            <div key={r.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${r.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}/>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 dark:text-slate-100">{r.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Cuando: <span className="text-indigo-500">{TRIGGER_LABELS[r.trigger_event] || r.trigger_event}</span>
                    {r.run_count > 0 && <span className="ml-2">· {r.run_count} ejecucion{r.run_count !== 1 ? 'es' : ''}</span>}
                    {r.last_run_at && <span className="ml-1">· última: {new Date(r.last_run_at).toLocaleString('es')}</span>}
                  </p>
                </div>
                {isManager && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => viewLogs(r.id)} title="Ver logs" className={`p-1.5 rounded text-slate-400 hover:text-slate-600 ${expandedLogs === r.id ? 'bg-slate-100 dark:bg-slate-700' : ''}`}>
                      {expandedLogs === r.id ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                    </button>
                    <button onClick={() => toggle(r.id)} title={r.is_active ? 'Desactivar' : 'Activar'} className={`p-1.5 rounded transition-colors ${r.is_active ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                      {r.is_active ? <Power size={14}/> : <PowerOff size={14}/>}
                    </button>
                    <button onClick={() => del(r.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 size={13}/></button>
                  </div>
                )}
              </div>
              {expandedLogs === r.id && (
                <div className="border-t border-slate-100 dark:border-slate-700 px-4 pb-3 pt-2">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase mb-2">Últimos logs</p>
                  {logs.length === 0 ? <p className="text-xs text-slate-400">Sin ejecuciones aún.</p> : (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {logs.map(l => (
                        <div key={l.id} className="flex items-center gap-2 text-xs">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${l.result === 'ok' ? 'bg-emerald-500' : 'bg-red-500'}`}/>
                          <span className="text-slate-500">{new Date(l.created_at).toLocaleString('es')}</span>
                          <span className="text-slate-400">{l.entity_type} #{l.entity_id}</span>
                          {l.detail && <span className="text-red-400 truncate">{l.detail}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
