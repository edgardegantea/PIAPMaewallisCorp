import { useEffect, useState } from 'react';
import { projectsAPI } from '../../services/projectsAPI';
import { toast } from 'sonner';
import { Plus, Trash2, Pin, CheckCheck, Megaphone } from 'lucide-react';

const EMPTY = { title: '', body: '', is_pinned: false, send_email: false };

export default function AnnouncementsView({ projectId, isManager }) {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]     = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    projectsAPI.getAnnouncements(projectId)
      .then(r => setItems(r.data ?? []))
      .catch(() => toast.error('Error al cargar anuncios'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [projectId]);

  const markRead = async (id) => {
    try {
      await projectsAPI.markAnnouncementRead(id);
      setItems(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a));
    } catch { /* silent */ }
  };

  const save = async () => {
    if (!form.title.trim() || !form.body.trim()) { toast.error('Título y cuerpo obligatorios'); return; }
    setSaving(true);
    try {
      if (form.id) {
        await projectsAPI.updateAnnouncement(form.id, form);
      } else {
        await projectsAPI.createAnnouncement(projectId, form);
      }
      toast.success('Anuncio guardado');
      setForm(null);
      load();
    } catch { toast.error('Error al guardar'); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm('¿Eliminar este anuncio?')) return;
    try {
      await projectsAPI.deleteAnnouncement(id);
      toast.success('Anuncio eliminado');
      load();
    } catch { toast.error('Error al eliminar'); }
  };

  if (loading) return <p className="py-10 text-center text-slate-400">Cargando…</p>;

  const pinned  = items.filter(a => a.is_pinned);
  const regular = items.filter(a => !a.is_pinned);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
          <Megaphone size={15} className="text-indigo-500" /> Anuncios del proyecto
        </h2>
        {isManager && !form && (
          <button onClick={() => setForm({ ...EMPTY })}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
            <Plus size={13} /> Nuevo anuncio
          </button>
        )}
      </div>

      {/* Form */}
      {form && (
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-3 border border-slate-200 dark:border-slate-600">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Título</label>
            <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="Título del anuncio" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Contenido</label>
            <textarea rows={4} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="Escribe el mensaje..." />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
              <input type="checkbox" checked={!!form.is_pinned} onChange={e => setForm(f => ({ ...f, is_pinned: e.target.checked }))}
                className="accent-indigo-600" />
              Fijar arriba
            </label>
            {!form.id && (
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                <input type="checkbox" checked={!!form.send_email} onChange={e => setForm(f => ({ ...f, send_email: e.target.checked }))}
                  className="accent-indigo-600" />
                Notificar por email al equipo
              </label>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
              {saving ? 'Guardando…' : 'Publicar'}
            </button>
            <button onClick={() => setForm(null)}
              className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {items.length === 0 && !form ? (
        <div className="py-16 text-center">
          <Megaphone size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">Sin anuncios aún</p>
          {isManager && <button onClick={() => setForm({ ...EMPTY })} className="mt-2 text-indigo-600 dark:text-indigo-400 text-xs hover:underline">Publicar el primero</button>}
        </div>
      ) : (
        <div className="space-y-3">
          {[...pinned, ...regular].map(a => (
            <div key={a.id} className={`rounded-xl border p-4 transition-all ${
              a.is_pinned
                ? 'border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20'
                : a.is_read
                  ? 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 opacity-70'
                  : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800'
            }`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {a.is_pinned && <Pin size={11} className="text-indigo-500 flex-shrink-0" />}
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{a.title}</span>
                    {!a.is_read && (
                      <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" title="No leído" />
                    )}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">{a.body}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                    {a.author_name ?? 'Equipo'} · {a.created_at?.slice(0, 10)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  {!a.is_read && (
                    <button onClick={() => markRead(a.id)}
                      title="Marcar como leído"
                      className="text-slate-400 hover:text-emerald-600 transition-colors">
                      <CheckCheck size={15} />
                    </button>
                  )}
                  {isManager && (
                    <>
                      <button onClick={() => setForm({ ...a, is_pinned: !!a.is_pinned })}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">Editar</button>
                      <button onClick={() => remove(a.id)}
                        className="text-xs text-red-500 hover:underline flex items-center gap-0.5">
                        <Trash2 size={11} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
