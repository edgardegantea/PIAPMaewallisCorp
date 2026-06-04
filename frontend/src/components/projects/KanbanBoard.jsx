import { useEffect, useRef, useState } from 'react';
import { projectsAPI } from '../../services/projectsAPI';
import { useAuthStore } from '../../stores/authStore';
import { toast } from 'sonner';
import { Plus, Trash2, Flag, Calendar, Clock, GripVertical, Download, User, AlertOctagon, Link2, RefreshCw, X, LayoutList, LayoutGrid, CheckSquare, Square as SquareIcon, ChevronUp, ChevronDown } from 'lucide-react';
import { downloadCSV } from '../../utils/csv';
import TaskDetailModal from './TaskDetailModal';
import { useActiveTimer, formatElapsed } from '../../hooks/useTimer';
import { deadlineInfo } from '../../utils/deadline';

const COLUMNS = [
  { id: 'PENDIENTE',   label: 'Pendiente',   color: 'border-slate-300',  bg: 'bg-slate-50',   header: 'bg-slate-100 text-slate-600',  drop: 'border-slate-400  bg-slate-100'  },
  { id: 'EN_PROGRESO', label: 'En Progreso', color: 'border-blue-300',   bg: 'bg-blue-50',    header: 'bg-blue-100 text-blue-700',    drop: 'border-blue-400   bg-blue-100'   },
  { id: 'BLOQUEADA',   label: 'Bloqueada',   color: 'border-red-300',    bg: 'bg-red-50',     header: 'bg-red-100 text-red-700',      drop: 'border-red-400    bg-red-100'    },
  { id: 'COMPLETADA',  label: 'Completada',  color: 'border-green-300',  bg: 'bg-green-50',   header: 'bg-green-100 text-green-700',  drop: 'border-green-400  bg-green-100'  },
];

const PRIORITY_STYLES = {
  BAJA:    { label: 'Baja',    dot: 'bg-slate-400',  text: 'text-slate-500',  bar: '#94a3b8' },
  MEDIA:   { label: 'Media',   dot: 'bg-blue-500',   text: 'text-blue-600',   bar: '#3b82f6' },
  ALTA:    { label: 'Alta',    dot: 'bg-amber-500',  text: 'text-amber-600',  bar: '#f59e0b' },
  CRITICA: { label: 'Crítica', dot: 'bg-red-500',    text: 'text-red-600',    bar: '#ef4444' },
};

const PRIORITIES = ['', 'BAJA', 'MEDIA', 'ALTA', 'CRITICA'];

/* ─── ReactivateModal ────────────────────────────────────────────────────── */
function ReactivateModal({ task, onClose, onReactivated }) {
  const today = new Date().toISOString().slice(0, 10);
  const [dueDate, setDueDate] = useState(today);
  const [dueTime, setDueTime] = useState('23:59');
  const [saving, setSaving]   = useState(false);

  const confirm = async () => {
    if (!dueDate) { toast.error('Selecciona una fecha'); return; }
    setSaving(true);
    try {
      await projectsAPI.updateTask(task.id, {
        due_date: dueDate,
        due_time: dueTime ? `${dueTime}:00` : null,
        status:   task.status === 'COMPLETADA' ? 'PENDIENTE' : task.status,
      });
      toast.success('Tarea reactivada');
      onReactivated();
      onClose();
    } catch { toast.error('Error al reactivar'); }
    finally { setSaving(false); }
  };

  const dl = deadlineInfo(task.due_date, task.due_time);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 text-amber-600">
            <RefreshCw size={16} />
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Reactivar tarea</h2>
          </div>
          <button onClick={onClose}><X size={16} className="text-slate-400 hover:text-slate-600" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium line-clamp-2">{task.title}</p>
          {dl?.overdue && (
            <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
              Venció hace {dl.label}. Establece una nueva fecha límite.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Nueva fecha *</label>
              <input type="date" value={dueDate} min={today}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white dark:bg-slate-700 dark:text-slate-100" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Hora límite</label>
              <input type="time" value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white dark:bg-slate-700 dark:text-slate-100" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 dark:border-slate-700">
          <button onClick={onClose} disabled={saving}
            className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">Cancelar</button>
          <button onClick={confirm} disabled={saving || !dueDate}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <RefreshCw size={13} />
            {saving ? 'Guardando…' : 'Reactivar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function KanbanBoard({ projectId, isManager = true }) {
  const { user }                        = useAuthStore();
  const activeTimer                     = useActiveTimer();
  const [sprints, setSprints]           = useState([]);
  const [tasks, setTasks]               = useState([]);
  const [sprintId, setSprintId]         = useState('');
  const [loading, setLoading]           = useState(true);
  const [newTask, setNewTask]           = useState({ column: '', title: '' });
  const [showNew, setShowNew]           = useState(null);
  const [priorityFilter, setPriority]   = useState('');
  const [onlyMine, setOnlyMine]         = useState(false);
  const [selectedTask, setSelectedTask]       = useState(null);
  const [reactivateTarget, setReactivateTarget] = useState(null);

  // ── Swimlanes ──────────────────────────────────────────────
  const [swimlaneBy, setSwimlaneBy]     = useState('none'); // 'none' | 'priority' | 'assignee'

  // ── View mode & bulk selection ─────────────────────────────
  const [viewMode, setViewMode]         = useState('board'); // 'board' | 'list'
  const [selectedIds, setSelectedIds]   = useState(new Set());
  const [sortField, setSortField]       = useState('');
  const [sortDir, setSortDir]           = useState('asc');
  const [bulkStatus, setBulkStatus]     = useState('');

  // ── Drag & drop state ──────────────────────────────────────
  const [draggingId, setDraggingId]     = useState(null);   // task.id being dragged
  const [dragOverCol, setDragOverCol]   = useState(null);   // column id hovered
  const dragCounter                     = useRef({});        // per-column enter counter

  // ──────────────────────────────────────────────────────────

  const loadTasks = (sid) => {
    if (sid) projectsAPI.getTasks({ sprint: sid }).then((r) => setTasks(r.data));
  };

  useEffect(() => {
    projectsAPI.getSprints(projectId).then((r) => {
      setSprints(r.data);
      const active = r.data.find((s) => s.status === 'ACTIVO') || r.data[0];
      if (active) { setSprintId(active.id); loadTasks(active.id); }
    }).finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { loadTasks(sprintId); }, [sprintId]);

  const filteredTasks = tasks
    .filter((t) => !priorityFilter  || t.priority === priorityFilter)
    .filter((t) => !onlyMine        || (t.assignees || []).some((a) => String(a.user_id) === String(user?.id)));

  const addTask = async (status) => {
    const title = newTask.title.trim();
    if (!title) return;
    try {
      await projectsAPI.createTask({ sprint_id: sprintId, title, status });
      toast.success('Tarea creada');
      setShowNew(null);
      setNewTask({ column: '', title: '' });
      loadTasks(sprintId);
    } catch { toast.error('Error al crear tarea'); }
  };

  // Optimistic move — updates UI instantly, syncs to backend in background
  const moveTask = async (taskId, newStatus) => {
    const prev = tasks.find((t) => String(t.id) === String(taskId));
    if (!prev || prev.status === newStatus) return;

    setTasks((all) =>
      all.map((t) => (String(t.id) === String(taskId) ? { ...t, status: newStatus } : t))
    );
    try {
      await projectsAPI.updateTask(taskId, { status: newStatus });
    } catch {
      toast.error('Error al mover tarea');
      setTasks((all) =>
        all.map((t) => (String(t.id) === String(taskId) ? { ...t, status: prev.status } : t))
      );
    }
  };

  const removeTask = async (taskId) => {
    try {
      await projectsAPI.deleteTask(taskId);
      setTasks((t) => t.filter((tk) => tk.id !== taskId));
    } catch { toast.error('Error'); }
  };

  // ── Bulk actions ───────────────────────────────────────────
  const toggleSelect = (id) => setSelectedIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTasks.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredTasks.map((t) => t.id)));
  };
  const clearSelection = () => { setSelectedIds(new Set()); setBulkStatus(''); };

  const bulkChangeStatus = async (status) => {
    if (!status) return;
    const ids = [...selectedIds];
    setTasks((all) => all.map((t) => ids.includes(t.id) ? { ...t, status } : t));
    try {
      await Promise.all(ids.map((id) => projectsAPI.updateTask(id, { status })));
      toast.success(`${ids.length} tarea(s) actualizadas`);
      clearSelection();
    } catch { toast.error('Error al actualizar'); loadTasks(sprintId); }
  };

  const bulkDelete = async () => {
    if (!window.confirm(`¿Eliminar ${selectedIds.size} tarea(s) seleccionada(s)? Esta acción no se puede deshacer.`)) return;
    const ids = [...selectedIds];
    setTasks((all) => all.filter((t) => !ids.includes(t.id)));
    try {
      await Promise.all(ids.map((id) => projectsAPI.deleteTask(id)));
      toast.success(`${ids.length} tarea(s) eliminadas`);
      clearSelection();
    } catch { toast.error('Error al eliminar'); loadTasks(sprintId); }
  };

  // ── Sort for list view ─────────────────────────────────────
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (!sortField) return 0;
    let va = a[sortField] ?? '';
    let vb = b[sortField] ?? '';
    if (sortField === 'due_date') { va = va || '9999'; vb = vb || '9999'; }
    const cmp = String(va).localeCompare(String(vb), 'es', { numeric: true });
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const SortBtn = ({ field, label }) => (
    <button onClick={() => { if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField(field); setSortDir('asc'); } }}
      className="flex items-center gap-1 hover:text-indigo-600 transition-colors">
      {label}
      {sortField === field
        ? (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)
        : <span className="w-3" />}
    </button>
  );

  // ── DnD handlers ──────────────────────────────────────────

  const handleDragStart = (e, taskId) => {
    setDraggingId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('taskId', String(taskId));
    // Slight delay so the ghost renders before the opacity kicks in
    setTimeout(() => {}, 0);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverCol(null);
    dragCounter.current = {};
  };

  // Using a counter to avoid flicker when cursor enters child elements
  const handleDragEnter = (e, colId) => {
    e.preventDefault();
    dragCounter.current[colId] = (dragCounter.current[colId] || 0) + 1;
    setDragOverCol(colId);
  };

  const handleDragLeave = (e, colId) => {
    dragCounter.current[colId] = (dragCounter.current[colId] || 1) - 1;
    if (dragCounter.current[colId] <= 0) {
      dragCounter.current[colId] = 0;
      setDragOverCol((prev) => (prev === colId ? null : prev));
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, colId) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) moveTask(taskId, colId);
    setDragOverCol(null);
    dragCounter.current = {};
    setDraggingId(null);
  };

  // ──────────────────────────────────────────────────────────

  if (loading) return <p className="text-slate-400 text-sm">Cargando...</p>;

  if (sprints.length === 0) {
    return <p className="text-slate-400 text-sm text-center py-8">Crea un sprint primero para usar el tablero Kanban</p>;
  }

  return (
    <div>
      {/* Filters bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {/* Sprint selector */}
        <select value={sprintId} onChange={(e) => setSprintId(e.target.value)}
          className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 sm:px-3 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:text-slate-100 max-w-[140px] sm:max-w-none">
          {sprints.map((s) => <option key={s.id} value={s.id}>Sprint {s.number}{s.name ? `: ${s.name}` : ''}</option>)}
        </select>
        {/* Priority filter */}
        <select value={priorityFilter} onChange={(e) => setPriority(e.target.value)}
          className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 sm:px-3 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:text-slate-100">
          <option value="">Prioridad</option>
          {PRIORITIES.filter(Boolean).map((p) => (
            <option key={p} value={p}>{PRIORITY_STYLES[p].label}</option>
          ))}
        </select>
        {/* My tasks toggle */}
        <button
          onClick={() => setOnlyMine((v) => !v)}
          title={onlyMine ? 'Ver todas las tareas' : 'Ver solo mis tareas'}
          className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors
            ${onlyMine
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
          <User size={12} /> <span className="hidden sm:inline">{onlyMine ? 'Mis tareas' : 'Todas'}</span>
        </button>
        <div className="ml-auto flex items-center gap-2">
          {filteredTasks.length > 0 && (
            <button onClick={() => downloadCSV(filteredTasks, [
              { key: 'title',               label: 'Título' },
              { key: 'status',              label: 'Estado' },
              { key: 'priority',            label: 'Prioridad' },
              { key: 'assignees', label: 'Asignados', transform: (v) => (v || []).map((a) => `${a.first_name} ${a.last_name}`).join(' | ') },
              { key: 'due_date',            label: 'Fecha Límite' },
              { key: 'estimated_hours',     label: 'Horas Estimadas' },
              { key: 'time_logged',         label: 'Horas Registradas' },
            ], 'tareas')}
              className="flex items-center gap-1.5 border border-slate-300 hover:bg-slate-50 text-slate-600 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors">
              <Download size={12} /> CSV
            </button>
          )}
          {/* Swimlane selector */}
          <select value={swimlaneBy} onChange={e => setSwimlaneBy(e.target.value)}
            title="Agrupar por swimlane"
            className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
            <option value="none">Sin swimlanes</option>
            <option value="priority">Por prioridad</option>
            <option value="assignee">Por asignado</option>
          </select>

          {/* View toggle */}
          <div className="flex border border-slate-300 rounded-lg overflow-hidden">
            <button onClick={() => { setViewMode('board'); clearSelection(); }}
              title="Vista tablero"
              className={`px-2.5 py-1.5 text-xs flex items-center gap-1 transition-colors ${viewMode === 'board' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
              <LayoutGrid size={13} />
            </button>
            <button onClick={() => setViewMode('list')}
              title="Vista lista"
              className={`px-2.5 py-1.5 text-xs flex items-center gap-1 transition-colors ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
              <LayoutList size={13} />
            </button>
          </div>
          <span className="text-xs text-slate-400 min-w-max">
            {filteredTasks.length} tarea{filteredTasks.length !== 1 ? 's' : ''}
            {draggingId && <span className="ml-2 text-indigo-400 font-medium animate-pulse">• arrastrando…</span>}
          </span>
        </div>
      </div>

      {/* ── Bulk action bar ──────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-xl px-4 py-2 mb-4 flex-wrap">
          <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
            <CheckSquare size={14} /> {selectedIds.size} seleccionada{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <select
            value={bulkStatus}
            onChange={(e) => { setBulkStatus(e.target.value); bulkChangeStatus(e.target.value); }}
            className="border border-indigo-300 dark:border-indigo-600 rounded-lg px-2 py-1 text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none">
            <option value="">Cambiar estado…</option>
            {COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          {isManager && (
            <button onClick={bulkDelete}
              className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 font-medium px-3 py-1 rounded-lg border border-red-200 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/20 transition-colors">
              <Trash2 size={13} /> Eliminar
            </button>
          )}
          <button onClick={clearSelection} className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 ml-auto">
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── LIST VIEW ──────────────────────────────────────── */}
      {viewMode === 'list' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                <th className="px-3 py-2.5 w-8">
                  <input type="checkbox"
                    checked={selectedIds.size > 0 && selectedIds.size === filteredTasks.length}
                    ref={(el) => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < filteredTasks.length; }}
                    onChange={toggleSelectAll}
                    className="accent-indigo-600" />
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  <SortBtn field="title" label="Tarea" />
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  <SortBtn field="status" label="Estado" />
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  <SortBtn field="priority" label="Prioridad" />
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden md:table-cell">Asignados</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  <SortBtn field="due_date" label="Vencimiento" />
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden lg:table-cell">Progreso</th>
                <th className="px-3 py-2.5 w-8" />
              </tr>
            </thead>
            <tbody>
              {sortedTasks.length === 0 && (
                <tr><td colSpan="8" className="text-center py-10 text-slate-400 text-sm">Sin tareas para mostrar</td></tr>
              )}
              {sortedTasks.map((task) => {
                const pri       = PRIORITY_STYLES[task.priority];
                const dl        = deadlineInfo(task.due_date, task.due_time);
                const isOverdue = dl?.overdue && task.status !== 'COMPLETADA';
                const STATUS_DOT = { PENDIENTE: 'bg-slate-400', EN_PROGRESO: 'bg-blue-500', BLOQUEADA: 'bg-red-500', COMPLETADA: 'bg-emerald-500' };
                const STATUS_LABEL = { PENDIENTE: 'Pendiente', EN_PROGRESO: 'En progreso', BLOQUEADA: 'Bloqueada', COMPLETADA: 'Completada' };
                const checked   = selectedIds.has(task.id);
                const pct       = task.estimated_hours > 0
                  ? Math.min(100, Math.round((task.time_logged / task.estimated_hours) * 100))
                  : null;

                return (
                  <tr key={task.id}
                    className={`border-b border-slate-100 dark:border-slate-700/50 last:border-0 transition-colors ${checked ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}>
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={checked} onChange={() => toggleSelect(task.id)} className="accent-indigo-600" />
                    </td>
                    <td className="px-3 py-2.5 max-w-[220px]">
                      <button onClick={() => setSelectedTask(task)}
                        className="text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 line-clamp-2 transition-colors">
                        {task.title}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-xs">
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[task.status]}`} />
                        <span className="text-slate-600 dark:text-slate-400">{STATUS_LABEL[task.status] || task.status}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {pri && (
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${pri.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${pri.dot}`} />
                          {pri.label}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell">
                      <div className="flex items-center gap-0.5">
                        {(task.assignees || []).slice(0, 3).map((a, i) => (
                          <div key={a.user_id} title={`${a.first_name} ${a.last_name}`}
                            className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold ring-1 ring-white dark:ring-slate-800 -ml-1 first:ml-0"
                            style={{ background: ['#6366f1','#8b5cf6','#3b82f6','#10b981','#f59e0b'][i % 5] }}>
                            {(a.first_name?.[0] || '')}{(a.last_name?.[0] || '')}
                          </div>
                        ))}
                        {(task.assignees || []).length > 3 && <span className="text-[10px] text-slate-400 ml-1">+{task.assignees.length - 3}</span>}
                        {!(task.assignees || []).length && <span className="text-xs text-slate-300">—</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {dl ? (
                        <span className={`text-xs font-medium ${isOverdue ? 'text-red-500' : dl.urgent ? 'text-amber-500' : 'text-slate-500 dark:text-slate-400'}`}>
                          {isOverdue ? `▲ ${dl.label}` : task.status === 'COMPLETADA' ? task.due_date : dl.label}
                        </span>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5 hidden lg:table-cell">
                      {pct !== null ? (
                        <div className="flex items-center gap-2 min-w-[80px]">
                          <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct > 100 ? '#ef4444' : '#6366f1' }} />
                          </div>
                          <span className="text-[10px] text-slate-400">{pct}%</span>
                        </div>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      {isManager && (
                        <div className="flex items-center gap-1">
                          {isOverdue && (
                            <button onClick={() => setReactivateTarget(task)}
                              title="Reactivar" className="text-amber-500 hover:text-amber-700 p-0.5 rounded transition-colors">
                              <RefreshCw size={12} />
                            </button>
                          )}
                          <button onClick={() => removeTask(task.id)}
                            title="Eliminar" className="text-red-400 hover:text-red-600 p-0.5 rounded transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Swimlane board ───────────────────────────────────── */}
      {viewMode === 'board' && swimlaneBy !== 'none' && (() => {
        // Build lane groups
        const getLaneKey = (task) => {
          if (swimlaneBy === 'priority') return task.priority || 'Sin prioridad';
          if (swimlaneBy === 'assignee') {
            const first = (task.assignees || [])[0];
            return first ? `${first.first_name} ${first.last_name}` : 'Sin asignar';
          }
          return 'General';
        };
        const lanesMap = {};
        filteredTasks.forEach(t => {
          const key = getLaneKey(t);
          if (!lanesMap[key]) lanesMap[key] = [];
          lanesMap[key].push(t);
        });
        const lanes = Object.entries(lanesMap);

        return (
          <div className="space-y-6">
            {lanes.map(([laneName, laneTasks]) => (
              <div key={laneName}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">{laneName}</span>
                  <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full">{laneTasks.length}</span>
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                </div>
                <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 pb-1"
                  style={{ WebkitOverflowScrolling: 'touch' }}>
                <div className="flex gap-3 sm:grid sm:grid-cols-4 min-w-max sm:min-w-0">
                  {COLUMNS.map(col => {
                    const colTasks = laneTasks.filter(t => t.status === col.id);
                    return (
                      <div key={col.id}
                        style={{ minWidth: '240px' }}
                        onDragEnter={e => handleDragEnter(e, col.id)}
                        onDragLeave={e => handleDragLeave(e, col.id)}
                        onDragOver={handleDragOver}
                        onDrop={e => handleDrop(e, col.id)}
                        className={`rounded-xl border-2 p-3 min-h-24 transition-all ${dragOverCol === col.id ? col.drop + ' shadow-lg' : col.color + ' ' + col.bg}`}>
                        <div className={`text-xs font-semibold mb-2 rounded px-2 py-0.5 ${col.header}`}>{col.label} ({colTasks.length})</div>
                        <div className="space-y-2">
                          {colTasks.map(task => (
                            <div key={task.id} draggable
                              onDragStart={e => handleDragStart(e, task.id)}
                              onDragEnd={handleDragEnd}
                              onClick={() => setSelectedTask(task)}
                              className="bg-white dark:bg-slate-800 rounded-lg p-2.5 shadow-sm cursor-grab text-xs hover:shadow-md transition-all">
                              <p className="font-medium text-slate-700 dark:text-slate-200 line-clamp-2">{task.title}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {viewMode === 'board' && swimlaneBy === 'none' && (
      <>
      {/* Mobile column summary chips */}
      <div className="flex gap-2 mb-3 sm:hidden overflow-x-auto pb-1 -mx-1 px-1"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {COLUMNS.map(col => {
          const count = filteredTasks.filter(t => t.status === col.id).length;
          return (
            <div key={col.id} className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${col.header}`}>
              <span>{col.label}</span>
              <span className="bg-white/60 rounded-full px-1.5 py-0.5 font-bold">{count}</span>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-400 mb-2 sm:hidden text-center">← Desliza para ver todas las columnas →</p>
      <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 pb-2"
        style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className="flex gap-3 sm:grid sm:grid-cols-4 min-w-max sm:min-w-0">
        {COLUMNS.map((col) => {
          const { id, label, color, bg, header, drop } = col;
          const colTasks  = filteredTasks.filter((t) => t.status === id);
          const isTarget  = dragOverCol === id;
          const isDragging = draggingId !== null;

          return (
            <div
              key={id}
              style={{ minWidth: '260px' }}
              onDragEnter={(e) => handleDragEnter(e, id)}
              onDragLeave={(e) => handleDragLeave(e, id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, id)}
              className={[
                'rounded-xl border-2 p-3 min-h-48 transition-all duration-150',
                isTarget
                  ? `${drop} shadow-lg scale-[1.01]`
                  : `${color} ${bg}`,
                isDragging && !isTarget ? 'opacity-80' : '',
              ].join(' ')}>

              {/* Column header */}
              <div className={`flex items-center justify-between mb-3 rounded-lg px-2 py-1 ${header}`}>
                <span className="text-xs font-semibold">{label}</span>
                <span className="text-xs bg-white/70 rounded-full px-2 py-0.5 font-medium">
                  {colTasks.length}
                </span>
              </div>

              {/* Drop hint when empty column is targeted */}
              {isTarget && colTasks.length === 0 && (
                <div className="flex items-center justify-center h-16 border-2 border-dashed border-current opacity-40 rounded-lg mb-2">
                  <span className="text-xs font-medium">Soltar aquí</span>
                </div>
              )}

              <div className="space-y-2 mb-2">
                {colTasks.map((task) => {
                  const pri           = PRIORITY_STYLES[task.priority];
                  const dl            = deadlineInfo(task.due_date, task.due_time);
                  const isOverdue     = dl?.overdue && task.status !== 'COMPLETADA';
                  const isBeingDragged = String(draggingId) === String(task.id);
                  const timerRunning  = activeTimer?.taskId === task.id;

                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => !isBeingDragged && setSelectedTask(task)}
                      className={[
                        'bg-white rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing',
                        'hover:shadow-md transition-all duration-150 group select-none',
                        isBeingDragged ? 'opacity-30 scale-95 shadow-none' : 'hover:-translate-y-0.5',
                      ].join(' ')}>

                      {/* Drag handle + title */}
                      <div className="flex items-start gap-1.5">
                        <GripVertical
                          size={13}
                          className="text-slate-300 group-hover:text-slate-400 mt-0.5 flex-shrink-0 transition-colors"
                        />
                        <p className="text-xs font-medium text-slate-700 line-clamp-2 flex-1">{task.title}</p>
                        {/* Timer running indicator */}
                        {timerRunning && (
                          <span className="flex-shrink-0 flex items-center gap-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            ⏱
                          </span>
                        )}
                      </div>

                      {/* Priority + due date */}
                      <div className="flex items-center gap-2 mt-1.5 pl-5">
                        {pri && (
                          <span className={`flex items-center gap-1 text-xs ${pri.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pri.dot}`} />
                            {pri.label}
                          </span>
                        )}
                        {dl && (
                          <span className={`flex items-center gap-0.5 text-xs font-medium ${
                            isOverdue    ? 'text-red-500' :
                            dl.urgent    ? 'text-amber-500' :
                            task.status === 'COMPLETADA' ? 'text-emerald-500' : 'text-slate-400'
                          }`}>
                            <Clock size={10} />
                            {isOverdue
                              ? `Vencida ${dl.label}`
                              : task.status === 'COMPLETADA'
                                ? task.due_date
                                : `Faltan ${dl.label}`}
                          </span>
                        )}
                      </div>

                      {/* Time progress bar */}
                      {task.estimated_hours > 0 && (
                        <div className="mt-1.5 pl-5">
                          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, (task.time_logged / task.estimated_hours) * 100)}%`,
                                background: task.time_logged > task.estimated_hours ? '#ef4444' : '#6366f1',
                              }} />
                          </div>
                          <span className="text-xs text-slate-400 flex items-center gap-0.5 mt-0.5">
                            <Clock size={9} /> {task.time_logged || 0}h / {task.estimated_hours}h
                          </span>
                        </div>
                      )}

                      {/* Assignees (multi) */}
                      {(task.assignees || []).length > 0 && (
                        <div className="flex items-center gap-0.5 mt-1.5 pl-5">
                          {task.assignees.slice(0, 4).map((a, i) => (
                            <div key={a.user_id}
                              title={`${a.first_name} ${a.last_name}`}
                              className="w-5 h-5 rounded-full flex items-center justify-center
                                text-white text-[9px] font-bold ring-1 ring-white -ml-1 first:ml-0"
                              style={{ background: ['#6366f1','#8b5cf6','#3b82f6','#10b981','#f59e0b','#ec4899'][i % 6] }}>
                              {(a.first_name?.[0] || '')}{(a.last_name?.[0] || '')}
                            </div>
                          ))}
                          {task.assignees.length > 4 && (
                            <span className="text-[10px] text-slate-400 ml-1">
                              +{task.assignees.length - 4}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Manager actions: Reactivar + Delete (shown on hover) */}
                      {isManager && (
                        <div className="flex items-center justify-between mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}>
                          {isOverdue ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); setReactivateTarget(task); }}
                              className="flex items-center gap-0.5 text-[10px] font-medium text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-1.5 py-0.5 rounded transition-colors">
                              <RefreshCw size={9} /> Reactivar
                            </button>
                          ) : <span />}
                          <button onClick={() => removeTask(task.id)}
                            className="text-red-400 hover:text-red-600 p-0.5 rounded hover:bg-red-50 transition-colors">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add task — managers only */}
              {isManager && (showNew === id ? (
                <div className="bg-white rounded-lg p-2 shadow-sm">
                  <input autoFocus value={newTask.title}
                    onChange={(e) => setNewTask({ column: id, title: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter')  addTask(id);
                      if (e.key === 'Escape') setShowNew(null);
                    }}
                    placeholder="Título de tarea…"
                    className="w-full text-xs border-none outline-none text-slate-700" />
                  <div className="flex gap-1 mt-1">
                    <button onClick={() => addTask(id)}
                      className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded">Agregar</button>
                    <button onClick={() => setShowNew(null)}
                      className="text-xs text-slate-400 px-2 py-0.5">✕</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowNew(id)}
                  className="w-full flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 py-1 transition-colors">
                  <Plus size={12} /> Agregar tarea
                </button>
              ))}
            </div>
          );
        })}
      </div>
      </div>
      </>)}
      {/* end swimlane === none */}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          projectId={projectId}
          isManager={isManager}
          onClose={() => setSelectedTask(null)}
          onSaved={() => { loadTasks(sprintId); setSelectedTask(null); }}
        />
      )}

      {reactivateTarget && (
        <ReactivateModal
          task={reactivateTarget}
          onClose={() => setReactivateTarget(null)}
          onReactivated={() => loadTasks(sprintId)}
        />
      )}
    </div>
  );
}
