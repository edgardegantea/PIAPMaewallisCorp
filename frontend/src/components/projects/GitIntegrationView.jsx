import { useEffect, useState } from 'react';
import { projectsAPI } from '../../services/projectsAPI';
import { toast } from 'sonner';
import { Plus, Trash2, GitBranch, GitCommit, Copy, Check, ExternalLink } from 'lucide-react';

const PROVIDERS = ['github', 'gitlab', 'bitbucket'];

const EMPTY = { provider: 'github', repo_url: '', branch_pattern: '*' };

export default function GitIntegrationView({ projectId, isManager }) {
  const [integrations, setIntegrations] = useState([]);
  const [commits, setCommits]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [form, setForm]                 = useState(null);
  const [saving, setSaving]             = useState(false);
  const [copied, setCopied]             = useState(null);

  const load = () => {
    Promise.all([
      projectsAPI.getGitIntegrations(projectId),
      projectsAPI.getGitCommits(projectId),
    ]).then(([gi, gc]) => {
      setIntegrations(gi.data ?? []);
      setCommits(gc.data ?? []);
    }).catch(() => toast.error('Error al cargar integración Git'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [projectId]);

  const save = async () => {
    if (!form.repo_url.trim()) { toast.error('URL del repositorio obligatoria'); return; }
    setSaving(true);
    try {
      await projectsAPI.createGitIntegration(projectId, form);
      toast.success('Integración creada');
      setForm(null);
      load();
    } catch { toast.error('Error al crear integración'); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm('¿Eliminar esta integración Git?')) return;
    try {
      await projectsAPI.deleteGitIntegration(id);
      toast.success('Integración eliminada');
      load();
    } catch { toast.error('Error al eliminar'); }
  };

  const copyWebhook = (url, id) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  if (loading) return <p className="py-10 text-center text-slate-400">Cargando…</p>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
          <GitBranch size={15} className="text-indigo-500" /> Integración Git
        </h2>
        {isManager && !form && (
          <button onClick={() => setForm({ ...EMPTY })}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
            <Plus size={13} /> Conectar repositorio
          </button>
        )}
      </div>

      {/* Form */}
      {form && (
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-3 border border-slate-200 dark:border-slate-600">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Proveedor</label>
              <select value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 capitalize">
                {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">URL del repositorio</label>
              <input type="url" value={form.repo_url} onChange={e => setForm(f => ({ ...f, repo_url: e.target.value }))}
                placeholder="https://github.com/org/repo"
                className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Patrón de rama <span className="text-slate-400 font-normal">(ej: main, feature/*, *)</span>
              </label>
              <input type="text" value={form.branch_pattern} onChange={e => setForm(f => ({ ...f, branch_pattern: e.target.value }))}
                placeholder="*"
                className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
              {saving ? 'Conectando…' : 'Conectar'}
            </button>
            <button onClick={() => setForm(null)}
              className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Integrations list */}
      {integrations.length === 0 && !form ? (
        <div className="py-12 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
          <GitBranch size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">Sin repositorios conectados</p>
          <p className="text-xs text-slate-400 mt-1">Conecta un repo para sincronizar commits con tareas usando <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">#ID_TAREA</code> en los mensajes</p>
          {isManager && <button onClick={() => setForm({ ...EMPTY })} className="mt-3 text-indigo-600 dark:text-indigo-400 text-xs hover:underline">Conectar repositorio</button>}
        </div>
      ) : (
        <div className="space-y-3">
          {integrations.map(int => (
            <div key={int.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <GitBranch size={15} className="text-slate-600 dark:text-slate-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 capitalize">{int.provider}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${int.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {int.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <a href={int.repo_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 mt-0.5">
                    {int.repo_url} <ExternalLink size={10} />
                  </a>
                  <p className="text-xs text-slate-400 mt-0.5">Rama: <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{int.branch_pattern}</code></p>

                  {/* Webhook URL */}
                  {int.webhook_url && (
                    <div className="mt-2 flex items-center gap-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2">
                      <code className="text-xs text-slate-600 dark:text-slate-300 flex-1 truncate">{int.webhook_url}</code>
                      <button onClick={() => copyWebhook(int.webhook_url, int.id)}
                        className="flex-shrink-0 text-slate-400 hover:text-indigo-600 transition-colors">
                        {copied === int.id ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                      </button>
                    </div>
                  )}
                  {int.webhook_secret && (
                    <p className="text-[10px] text-slate-400 mt-1">Secret: <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{int.webhook_secret}</code></p>
                  )}
                </div>
                {isManager && (
                  <button onClick={() => remove(int.id)}
                    className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Commits feed */}
      {commits.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <GitCommit size={12} /> Commits recientes
          </h3>
          <div className="space-y-2">
            {commits.slice(0, 20).map(c => (
              <div key={c.id} className="flex items-start gap-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2.5">
                <GitCommit size={13} className="text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-700 dark:text-slate-200 truncate">{c.message}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] text-slate-400">{c.author}</span>
                    <span className="text-[10px] text-slate-400">{c.committed_at?.slice(0, 10)}</span>
                    {c.branch && <span className="text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-1 rounded">{c.branch}</span>}
                    {c.task_id && <span className="text-[10px] bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-1 rounded">→ Tarea #{c.task_id}</span>}
                  </div>
                </div>
                <code className="text-[10px] text-slate-400 font-mono flex-shrink-0">{c.commit_hash?.slice(0, 7)}</code>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
