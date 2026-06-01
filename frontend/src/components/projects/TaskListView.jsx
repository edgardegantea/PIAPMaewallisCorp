import { useEffect, useState } from 'react';
import { projectsAPI } from '../../services/projectsAPI';
import { useAuthStore } from '../../stores/authStore';
import { toast } from 'sonner';
import {
  ChevronDown, ChevronRight, CheckCircle2, Circle,
  AlertTriangle, Flag, Calendar, Clock, User, Tag,
  LayoutList, Filter, ArrowUpDown,
} from 'lucide-react';
import TaskDetailModal from './TaskDetailModal';

const STATUS_STYLE = {
  PENDIENTE:   { dot: 'bg-slate-400',   label: 'Pendiente',   badge: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  EN_PROGRESO: { dot: 'bg-blue-500',    label: 'En Progreso', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  BLOQUEADA:   { dot: 'bg-red-500',     label: 'Bloqueada',   badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  COMPLETADA:  { dot: 'bg-emerald-500', label: 'Completada',  badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
};
const PRIORITY_STYLE = {
  BAJA:    { dot: 'bg-slate-400',  label: 'Baja',    badge: 'bg-slate-100 text-slate-600' },
  MEDIA:   { dot: 'bg-blue-400',   label: 'Media',   badge: 'bg-blue-100 text-blue-700' },
  ALTA:    { dot: 'bg-amber-500',  label: 'Alta',    badge: 'bg-amber-100 text-amber-700' },
  CRITICA: { dot: 'bg-red-500',    label: 'Crítica', badge: 'bg-red-100 text-red-700' },
};

const GROUP_OPTIONS = [
  { id: 'status',    label: 'Estado' },
  { id: 'priority',  label: 'Prioridad' },
  { id: 'assignee',  label: 'Asignado' },
  { id: 'sprint',    label: 'Sprint' },
  { id: 'none',      label: 'Sin agrupar' },
];

const SORT_OPTIONS = [
  { id: 'created_at', label: 'Fecha creación' },
  { id: 'due_date',   label: 'Fecha límite' },
  { id: 'priority',   label: 'Prioridad' },
  { id: 'title',      label: 'Título' },
];

const PRIORITY_ORDER = { CRITICA: 0, ALTA: 1, MEDIA: 2, BAJA: 3 };

function getGroupKey(task, groupBy) {
  switch (groupBy) {
    case 'status':   return task.status || 'PENDIENTE';
    case 'priority': return task.priority || 'MEDIA';
    case 'assignee': {
      const first = (task.assignees || [])[0];
      return first ? `${first.first_name} ${first.last_name}` : 'Sin asignar';
    }
    case 'sprint':   return task.sprint_name || task.sprint_id || 'Sin sprint';
    default:         return 'Todas las tareas';
  }
}

function getGroupOrder(key, groupBy) {
  if (groupBy === 'priority') return PRIORITY_ORDER[key] ?? 99;
  if (groupBy === 'status')   return ['PENDIENTE','EN_PROGRESO','BLOQUEADA','COMPLETADA'].indexOf(key);
  return key;
}

function GroupHeader({ label, count, open, onToggle, groupBy }) {
  const style =
    groupBy === 'status'   ? STATUS_STYLE[label]   :
    groupBy === 'priority' ? PRIORITY_STYLE[label] : null;
  const dot = style?.dot ?? 'bg-slate-400';

  return (
    <button onClick={onToggle}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left group">
      {open ? <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />
             : <ChevronRight size={14} className="text-slate-400 flex-shrink-0" />}
      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot}`} />
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex-1">
        {style?.label ?? label}
      </span>
      <span className="text-xs bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-medium">
        {count}
      </span>
    </button>
  );
}

function TaskRow({ task, isManager, onStatusChange, onOpen }) {
  const st  = STATUS_STYLE[task.status]   ?? STATUS_STYLE.PENDIENTE;
  const pri = PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.MEDIA;
  const isOverdue = task.due_date && task.status !== 'COMPLETADA' && new Date(task.due_date) < new Date();
  const isDone    = task.status === 'COMPLETADA';

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 border-b border-slate-50 dark:border-slate-700/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group cursor-pointer"
      onClick={() => onOpen(task)}>

      {/* Status toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); onStatusChange(task); }}
        className="flex-shrink-0"
        title="Cambiar estado">
        {isDone
          ? <CheckCircle2 size={16} className="text-emerald-500" />
          : <Circle       size={16} className="text-slate-300 dark:text-slate-500 hover:text-indigo-400 transition-colors" />
        }
      </button>

      {/* Title */}
      <span className={`flex-1 text-sm min-w-0 truncate ${isDone ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>
        {task.title}
      </span>

      {/* Priority dot */}
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${pri.dot}`} title={pri.label} />

      {/* Assignees avatars */}
      {(task.assignees || []).length > 0 && (
        <div className="flex -space-x-1 flex-shrink-0">
          {task.assignees.slice(0, 2).map((a, i) => (
            <div key={i}
              className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[8px] font-bold border border-white dark:border-slate-800"
              title={`${a.first_name} ${a.last_name}`}>
              {(a.first_name?.[0] || '')}{(a.last_name?.[0] || '')}
            </div>
          ))}
          {task.assignees.length > 2 && (
            <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300 text-[8px] font-bold border border-white dark:border-slate-800">
              +{task.assignees.length - 2}
            </div>
          )}
        </div>
      )}

      {/* Due date */}
      {task.due_date && (
        <span className={`text-xs flex-shrink-0 flex items-center gap-1 ${
          isOverdue ? 'text-red-500 font-medium' : 'text-slate-400'
        }`}>
          <Calendar size={11} />
          {task.due_date}
        </span>
      )}

      {/* Status badge */}
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 hidden sm:inline ${st.badge}`}>
        {st.label}
      </span>

      {/* Time */}
      {parseFloat(task.estimated_hours) > 0 && (
        <span className="text-xs text-slate-400 flex-shrink-0 hidden md:flex items-center gap-1">
          <Clock size={11} />
          {parseFloat(task.time_logged || 0).toFixed(0)}/{parseFloat(task.estimated_hours).toFixed(0)}h
        </span>
      )}
    </div>
  );
}

export default function TaskListView({ projectId, isManager, sprintId: externalSprintId }) {
  const { user }                         = useAuthStore();
  const [sprints, setSprints]            = useState([]);
  const [tasks, setTasks]                = useState([]);
  const [sprintId, setSprintId]          = useState(externalSprintId || '');
  const [loading, setLoading]            = useState(true);
  const [groupBy, setGroupBy]            = useState('status');
  const [sortBy, setSortBy]              = useState('created_at');
  const [sortDir, setSortDir]            = useState('desc');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStatus, setFilterStatus]    = useState('');
  const [onlyMine, setOnlyMine]            = useState(false);
  const [collapsed, setCollapsed]          = useState({});
  const [selectedTask, setSelectedTask]    = useState(null);

  useEffect(() => {
    projectsAPI.getSprints(projectId).then(r => {
      const list = r.data ?? [];
      setSprints(list);
      if (!externalSprintId) {
        const active = list.find(s => s.status === 'ACTIVO') || list[0];
        if (active) setSprintId(active.id);
      }
    });
  }, [projectId]);

  useEffect(() => {
    if (!sprintId) return;
    setLoading(true);
    projectsAPI.getTasks({ sprint: sprintId, per_page: 200 })
      .then(r => setTasks(r.data?.data ?? r.data ?? []))
      .catch(() => toast.error('Error al cargar tareas'))
      .finally(() => setLoading(false));
  }, [sprintId]);

  const reload = () => {
    if (!sprintId) return;
    projectsAPI.getTasks({ sprint: sprintId, per_page: 200 }).then(r => setTasks(r.data?.data ?? r.data ?? []));
  };

  const toggleStatus = async (task) => {
    const newStatus = task.status === 'COMPLETADA' ? 'PENDIENTE' : 'COMPLETADA';
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    try { await projectsAPI.updateTask(task.id, { status: newStatus }); }
    catch { setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t)); }
  };

  // Filter + sort
  const filtered = tasks
    .filter(t => !filterPriority || t.priority === filterPriority)
    .filter(t => !filterStatus   || t.status   === filterStatus)
    .filter(t => !onlyMine       || (t.assignees || []).some(a => String(a.user_id) === String(user?.id)))
    .sort((a, b) => {
      let va = a[sortBy] ?? '', vb = b[sortBy] ?? '';
      if (sortBy === 'priority') { va = PRIORITY_ORDER[a.priority] ?? 99; vb = PRIORITY_ORDER[b.priority] ?? 99; }
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      const cmp = va > vb ? 1 : va < vb ? -1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });

  // Group
  const groupsMap = {};
  filtered.forEach(t => {
    const key = getGroupKey(t, groupBy);
    if (!groupsMap[key]) groupsMap[key] = [];
    groupsMap[key].push(t);
  });
  const groups = Object.entries(groupsMap).sort(([a], [b]) => {
    const oa = getGroupOrder(a, groupBy), ob = getGroupOrder(b, groupBy);
    return typeof oa === 'number' && typeof ob === 'number' ? oa - ob : String(oa).localeCompare(String(ob));
  });

  const toggleGroup = (key) => setCollapsed(p => ({ ...p, [key]: !p[key] }));

  if (loading) return <p className="text-center py-10 text-slate-400">Cargando…</p>;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Sprint selector */}
        <select value={sprintId} onChange={e => setSprintId(e.target.value)}
          className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400">
          {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        {/* Group by */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400">Agrupar:</span>
          <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600">
            {GROUP_OPTIONS.map(g => (
              <button key={g.id} onClick={() => setGroupBy(g.id)}
                className={`px-2.5 py-1.5 text-xs transition-colors ${groupBy === g.id ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'}`}>
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1">
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 focus:outline-none">
            {SORT_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            className="p-1.5 text-slate-400 hover:text-indigo-600 border border-slate-200 dark:border-slate-600 rounded-lg transition-colors"
            title={sortDir === 'asc' ? 'Ascendente' : 'Descendente'}>
            <ArrowUpDown size={13} />
          </button>
        </div>

        {/* Filters */}
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
          className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 focus:outline-none">
          <option value="">Todas las prioridades</option>
          {Object.entries(PRIORITY_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 focus:outline-none">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        <button onClick={() => setOnlyMine(v => !v)}
          className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${onlyMine ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
          <User size={11} /> {onlyMine ? 'Mis tareas' : 'Todas'}
        </button>

        <span className="ml-auto text-xs text-slate-400">{filtered.length} tarea{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Groups */}
      {groups.length === 0 ? (
        <div className="py-12 text-center text-slate-400">
          <LayoutList size={28} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Sin tareas con los filtros aplicados</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          {groups.map(([key, groupTasks], gi) => (
            <div key={key} className={gi > 0 ? 'border-t border-slate-100 dark:border-slate-700' : ''}>
              {/* Group header */}
              <div className="px-2 py-1">
                <GroupHeader
                  label={key}
                  count={groupTasks.length}
                  open={!collapsed[key]}
                  onToggle={() => toggleGroup(key)}
                  groupBy={groupBy}
                />
              </div>

              {/* Task rows */}
              {!collapsed[key] && (
                <div>
                  {groupTasks.map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      isManager={isManager}
                      onStatusChange={toggleStatus}
                      onOpen={setSelectedTask}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          projectId={projectId}
          isManager={isManager}
          onClose={() => setSelectedTask(null)}
          onSaved={() => { reload(); setSelectedTask(null); }}
        />
      )}
    </div>
  );
}
