import { useEffect, useState, useCallback } from 'react';
import { projectsAPI } from '../../services/projectsAPI';
import { toast } from 'sonner';
import { Package, Plus, Trash2, Edit2, Zap, Check, ChevronDown, ChevronUp, Loader2, X, Tag } from 'lucide-react';

const STATUS_COLORS = { PLANNED:'bg-slate-100 text-slate-600', IN_PROGRESS:'bg-indigo-100 text-indigo-700', RELEASED:'bg-emerald-100 text-emerald-700', CANCELLED:'bg-red-100 text-red-600' };
const STATUS_LABELS = { PLANNED:'Planificado', IN_PROGRESS:'En curso', RELEASED:'Publicado', CANCELLED:'Cancelado' };
const inputCls = 'w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500';

export default function ReleasesView({ projectId, isManager }) {
  const [releases, setReleases] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ name: '', version: '', status: 'PLANNED', release_date: '', description: '' });
  const [expanded, setExpanded] = useState({});
  const [taskData, setTaskData] = useState({});
  const [generating, setGenerating] = useState(null);

  const load = useCallback(() =>
    projectsAPI.getReleases(projectId).then(r => setReleases(r.data)).catch(() => {}).finally(() => setLoading(false))
  , [projectId]);

  useEffect(() => { load(); }, [load]);

  const create = async (e) => {
    e.preventDefault();
    try { await projectsAPI.createRelease(projectId, form); toast.success('Release creado'); setShowForm(false); setForm({ name:'',version:'',status:'PLANNED',release_date:'',description:'' }); load(); }
    catch { toast.error('Error al crear release'); }
  };

  const del = async (id) => { await projectsAPI.deleteRelease(id); load(); };

  const toggle = async (id) => {
    if (expanded[id]) { setExpanded(p => ({ ...p, [id]: false })); return; }
    const r = await projectsAPI.getReleaseTasks(id);
    setTaskData(p => ({ ...p, [id]: r.data }));
    setExpanded(p => ({ ...p, [id]: true }));
  };

  const generateChangelog = async (id) => {
    setGenerating(id);
    try {
      const r = await projectsAPI.generateChangelog(id);
      toast.success('Changelog generado');
      setReleases(releases.map(rel => rel.id === id ? { ...rel, changelog: r.data.changelog } : rel));
    } catch { toast.error('Error al generar changelog'); }
    finally { setGenerating(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Package size={18} className="text-indigo-500"/><h3 className="font-semibold text-slate-700 dark:text-slate-200">Versiones / Releases</h3></div>
        {isManager && <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"><Plus size={14}/> Nuevo release</button>}
      </div>

      {showForm && (
        <form onSubmit={create} className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-indigo-200 dark:border-indigo-800 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Nombre *</label><input required value={form.name} onChange={e => setForm(f => ({...f,name:e.target.value}))} placeholder="Release 1.0" className={inputCls}/></div>
            <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Versión</label><input value={form.version} onChange={e => setForm(f => ({...f,version:e.target.value}))} placeholder="v1.0.0" className={inputCls}/></div>
            <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Estado</label>
              <select value={form.status} onChange={e => setForm(f => ({...f,status:e.target.value}))} className={inputCls}>
                {Object.entries(STATUS_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Fecha de release</label><input type="date" value={form.release_date} onChange={e => setForm(f => ({...f,release_date:e.target.value}))} className={inputCls}/></div>
          </div>
          <div><label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Descripción</label><textarea rows={2} value={form.description} onChange={e => setForm(f => ({...f,description:e.target.value}))} className={inputCls+' resize-none'}/></div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-slate-500 px-3 py-2">Cancelar</button>
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">Guardar</button>
          </div>
        </form>
      )}

      {loading ? <div className="text-center py-12 text-slate-400">Cargando…</div> : releases.length === 0 ? (
        <div className="text-center py-12 text-slate-400"><Package size={36} className="mx-auto mb-3 opacity-30"/><p>Sin releases creados aún.</p></div>
      ) : (
        <div className="space-y-3">
          {releases.map(rel => (
            <div key={rel.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{rel.name}</span>
                    {rel.version && <span className="text-xs font-mono text-slate-400">{rel.version}</span>}
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[rel.status]}`}>{STATUS_LABELS[rel.status]}</span>
                    {rel.release_date && <span className="text-xs text-slate-400">{rel.release_date}</span>}
                    <span className="text-xs text-slate-400">{rel.task_count} tarea{rel.task_count !== 1 ? 's' : ''}</span>
                  </div>
                  {rel.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{rel.description}</p>}
                </div>
                <div className="flex items-center gap-1">
                  {isManager && (
                    <button onClick={() => generateChangelog(rel.id)} disabled={generating === rel.id} title="Generar changelog" className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition-colors">
                      {generating === rel.id ? <Loader2 size={13} className="animate-spin"/> : <Zap size={13}/>}
                    </button>
                  )}
                  <button onClick={() => toggle(rel.id)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded">
                    {expanded[rel.id] ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                  </button>
                  {isManager && <button onClick={() => del(rel.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded"><Trash2 size={13}/></button>}
                </div>
              </div>

              {expanded[rel.id] && (
                <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-3 space-y-3">
                  {rel.changelog && (
                    <div className="bg-slate-50 dark:bg-slate-900/40 rounded-lg p-3">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Changelog</p>
                      <pre className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-sans">{rel.changelog}</pre>
                    </div>
                  )}
                  {(taskData[rel.id] || []).length === 0 ? <p className="text-xs text-slate-400">Sin tareas vinculadas.</p> : (
                    <div className="space-y-1">
                      {(taskData[rel.id] || []).map(t => (
                        <div key={t.id} className="flex items-center gap-2 text-xs">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.status==='COMPLETADA'?'bg-emerald-500':t.status==='EN_PROGRESO'?'bg-indigo-500':'bg-slate-300'}`}/>
                          <span className="text-slate-700 dark:text-slate-200">{t.title}</span>
                          <span className="text-slate-400">{t.sprint_name}</span>
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
