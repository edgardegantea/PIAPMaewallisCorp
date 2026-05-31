import { useEffect, useRef, useState } from 'react';
import { projectsAPI } from '../../services/projectsAPI';
import { useAuthStore } from '../../stores/authStore';
import { toast } from 'sonner';
import {
  Activity, CheckCircle2, Plus, Edit2, Trash2, Flag,
  AlertTriangle, Users, RefreshCw, Check, X, Radio,
} from 'lucide-react';

const POLL_INTERVAL = 30_000; // 30 s

const ACTION_META = {
  task_created:        { icon: Plus,          color: 'bg-indigo-100 text-indigo-600',   label: 'Tarea creada' },
  task_status_changed: { icon: RefreshCw,     color: 'bg-blue-100 text-blue-600',       label: 'Estado cambiado' },
  task_completed:      { icon: CheckCircle2,  color: 'bg-emerald-100 text-emerald-600', label: 'Tarea completada' },
  milestone_completed: { icon: Flag,          color: 'bg-purple-100 text-purple-600',   label: 'Hito completado' },
  risk_created:        { icon: AlertTriangle, color: 'bg-amber-100 text-amber-600',     label: 'Riesgo identificado' },
  incident_created:    { icon: AlertTriangle, color: 'bg-red-100 text-red-600',         label: 'Incidencia reportada' },
  incident_updated:    { icon: Edit2,         color: 'bg-orange-100 text-orange-600',   label: 'Incidencia actualizada' },
  default:             { icon: Activity,      color: 'bg-slate-100 text-slate-600',     label: 'Actividad' },
};

function timeSince(dateStr) {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (mins < 1)   return 'ahora mismo';
  if (mins < 60)  return `hace ${mins}m`;
  if (hours < 24) return `hace ${hours}h`;
  if (days < 7)   return `hace ${days}d`;
  return new Date(dateStr).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

const ACTION_GROUPS = [
  { key: 'all',       label: 'Todo' },
  { key: 'tasks',     label: 'Tareas',      match: (a) => a?.startsWith('task_')      },
  { key: 'milestones',label: 'Hitos',       match: (a) => a?.startsWith('milestone_') },
  { key: 'risks',     label: 'Riesgos',     match: (a) => a?.startsWith('risk_')      },
  { key: 'incidents', label: 'Incidencias', match: (a) => a?.startsWith('incident_')  },
];

export default function ActivityFeed({ projectId }) {
  const authUser = useAuthStore((s) => s.user);

  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [editingId, setEditingId]   = useState(null);
  const [editText, setEditText]     = useState('');
  const [saving, setSaving]         = useState(false);
  const [actionFilter, setActionFilter] = useState('all');
  const [liveMode, setLiveMode]         = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const pollRef = useRef(null);
  const PER_PAGE = 15;

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    projectsAPI.getActivity(projectId)
      .then((r) => { setItems(r.data || []); setLastRefreshed(new Date()); })
      .catch(() => {})
      .finally(() => { if (!silent) setLoading(false); });
  };

  // Start/stop live polling
  useEffect(() => {
    if (liveMode) {
      pollRef.current = setInterval(() => load(true), POLL_INTERVAL);
    } else {
      clearInterval(pollRef.current);
    }
    return () => clearInterval(pollRef.current);
  }, [liveMode, projectId]);

  useEffect(() => { load(); }, [projectId]);

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditText(item.description);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const saveEdit = async (id) => {
    if (!editText.trim()) return;
    setSaving(true);
    try {
      await projectsAPI.updateActivity(id, { description: editText.trim() });
      setItems((prev) => prev.map((it) => it.id === id ? { ...it, description: editText.trim() } : it));
      setEditingId(null);
      toast.success('Mensaje actualizado');
    } catch {
      toast.error('Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este mensaje de actividad?')) return;
    try {
      await projectsAPI.deleteActivity(id);
      setItems((prev) => prev.filter((it) => it.id !== id));
      toast.success('Mensaje eliminado');
    } catch {
      toast.error('Error al eliminar');
    }
  };

  if (loading) return <div className="text-center py-20 text-slate-400">Cargando actividad...</div>;

  if (items.length === 0) {
    return (
      <div className="text-center py-20 text-slate-400">
        <Activity size={40} className="mx-auto mb-3 opacity-30" />
        <p>Sin actividad registrada aún.</p>
        <p className="text-xs mt-1">Las acciones sobre tareas, hitos, riesgos e incidencias aparecerán aquí.</p>
      </div>
    );
  }

  const activeGroup = ACTION_GROUPS.find((g) => g.key === actionFilter);
  const filtered = actionFilter === 'all'
    ? items
    : items.filter((it) => activeGroup?.match(it.action));

  const paginated = filtered.slice(0, page * PER_PAGE);
  const hasMore   = paginated.length < filtered.length;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-indigo-500" />
            <h3 className="font-semibold text-slate-700 dark:text-slate-200">Actividad del Proyecto</h3>
            <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
              {filtered.length}{actionFilter !== 'all' && `/${items.length}`}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {lastRefreshed && liveMode && (
              <span className="text-[10px] text-slate-400 hidden sm:block">
                {lastRefreshed.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
            <button onClick={() => setLiveMode(v => !v)}
              title={liveMode ? 'Desactivar actualización automática' : 'Activar actualización automática (30s)'}
              className={`p-1.5 rounded-lg transition-colors ${liveMode ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 animate-pulse' : 'text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
              <Radio size={14} />
            </button>
            <button onClick={() => load()}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title="Actualizar ahora">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
        {/* Action-type filter chips */}
        <div className="flex gap-1.5 flex-wrap">
          {ACTION_GROUPS.map((g) => {
            const count = g.key === 'all' ? items.length : items.filter((it) => g.match?.(it.action)).length;
            if (g.key !== 'all' && count === 0) return null;
            return (
              <button key={g.key}
                onClick={() => { setActionFilter(g.key); setPage(1); }}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                  actionFilter === g.key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}>
                {g.label}
                {g.key !== 'all' && <span className="ml-1 opacity-70">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="divide-y divide-slate-50 dark:divide-slate-700">
        {paginated.map((item, idx) => {
          const meta     = ACTION_META[item.action] || ACTION_META.default;
          const Icon     = meta.icon;
          const initials = ((item.first_name?.[0] || '') + (item.last_name?.[0] || '')).toUpperCase()
            || item.username?.[0]?.toUpperCase() || '?';
          const isOwn    = authUser && String(item.user_id) === String(authUser.id);
          const isEditing = editingId === item.id;

          return (
            <div key={item.id || idx} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
              {/* Action icon */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                <Icon size={14} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(item.id); if (e.key === 'Escape') cancelEdit(); }}
                      className="flex-1 border border-indigo-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                    />
                    <button onClick={() => saveEdit(item.id)} disabled={saving}
                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors">
                      <Check size={15} />
                    </button>
                    <button onClick={cancelEdit}
                      className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg transition-colors">
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug">{item.description}</p>
                )}

                <div className="flex items-center gap-3 mt-1">
                  {item.username && (
                    <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                      <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                        {initials}
                      </span>
                      {item.first_name || item.username}
                    </span>
                  )}
                  <span className="text-xs text-slate-400">{timeSince(item.created_at)}</span>
                </div>
              </div>

              {/* Own-entry actions */}
              {isOwn && !isEditing && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button onClick={() => startEdit(item)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                    title="Editar">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => handleDelete(item.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    title="Eliminar">
                    <Trash2 size={13} />
                  </button>
                </div>
              )}

              {/* Date */}
              {!isEditing && (
                <span className="text-xs text-slate-300 dark:text-slate-500 flex-shrink-0 hidden sm:block">
                  {new Date(item.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {hasMore && (
        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-700 text-center">
          <button onClick={() => setPage((p) => p + 1)}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium hover:underline">
            Cargar más ({filtered.length - paginated.length} restantes)
          </button>
        </div>
      )}
    </div>
  );
}
