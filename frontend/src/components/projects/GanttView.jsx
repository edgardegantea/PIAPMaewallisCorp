/**
 * GanttView — Interactive timeline with drag-to-move and drag-to-resize.
 *
 * Sprint bars  → drag to move (updates start_date + end_date)
 *             → drag right handle to resize (updates end_date)
 * Task markers → drag to move due_date
 * Milestones   → drag to move due_date
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { projectsAPI } from '../../services/projectsAPI';
import { CheckCircle2, Flag, Zap, Calendar, ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { toast } from 'sonner';

// ── Helpers ───────────────────────────────────────────────────────────────────

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function diffDays(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}
function toISO(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmt(date) {
  return new Date(date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

const SPRINT_COLORS    = ['#6366f1','#8b5cf6','#06b6d4','#3b82f6','#10b981','#f59e0b'];
const MILESTONE_COLORS = { completed: '#10b981', pending: '#6366f1', overdue: '#ef4444' };
const PRIORITY_COLORS  = { CRITICA: '#ef4444', ALTA: '#f97316', MEDIA: '#eab308', BAJA: '#94a3b8' };

// ── Component ─────────────────────────────────────────────────────────────────

export default function GanttView({ projectId, project }) {
  const [sprints,    setSprints]    = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [tasks,      setTasks]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [viewMode,   setViewMode]   = useState('sprint'); // 'sprint' | 'task'
  const [dayOffset,  setDayOffset]  = useState(0);
  const [saving,     setSaving]     = useState(false);

  // Pending edits: { sprints: {id: {start_date, end_date}}, tasks: {id: {due_date}}, milestones: {id: {due_date}} }
  const [dirty, setDirty] = useState({ sprints: {}, tasks: {}, milestones: {} });

  const trackRef = useRef(null); // the scrollable track div

  useEffect(() => {
    Promise.all([
      projectsAPI.getSprints(projectId),
      projectsAPI.getMilestones(projectId),
      projectsAPI.getTasks({ project_id: projectId, per_page: 200 }),
    ]).then(([sp, ml, tk]) => {
      setSprints(sp.data ?? []);
      setMilestones(ml.data ?? []);
      setTasks((tk.data?.data ?? tk.data ?? []).filter((t) => !t.parent_task_id));
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <div className="text-center py-20 text-slate-400">Cargando...</div>;

  // ── Timeline range ────────────────────────────────────────────────────────
  const allDates = [
    ...(project?.planned_start_date ? [new Date(project.planned_start_date)] : []),
    ...(project?.planned_end_date   ? [new Date(project.planned_end_date)]   : []),
    ...sprints.filter((s) => s.start_date && s.end_date)
              .flatMap((s) => [new Date(s.start_date), new Date(s.end_date)]),
    ...milestones.filter((m) => m.due_date).map((m) => new Date(m.due_date)),
    ...tasks.filter((t) => t.due_date).map((t) => new Date(t.due_date)),
  ].filter((d) => !isNaN(d));

  if (allDates.length === 0) {
    return (
      <div className="text-center py-20 text-slate-400">
        <Calendar size={40} className="mx-auto mb-3 opacity-30" />
        <p>No hay sprints ni hitos con fechas para mostrar.</p>
      </div>
    );
  }

  const baseMin = new Date(Math.min(...allDates));
  const baseMax = new Date(Math.max(...allDates));
  baseMin.setDate(baseMin.getDate() - 3 + dayOffset);
  baseMax.setDate(baseMax.getDate() + 3 + dayOffset);
  const totalDays = diffDays(baseMin, baseMax) || 1;

  const pct   = (date) => Math.max(0, Math.min(100, (diffDays(baseMin, date) / totalDays) * 100));
  const width  = (start, end) => Math.max(0.5, (diffDays(start, end) / totalDays) * 100);

  // Convert pixel delta → days given current track width
  const pxToDays = (px) => {
    const trackW = trackRef.current?.getBoundingClientRect().width ?? 600;
    return Math.round((px / trackW) * totalDays);
  };

  // Month markers
  const months = [];
  let cursor = new Date(baseMin.getFullYear(), baseMin.getMonth(), 1);
  while (cursor <= baseMax) {
    months.push({
      label: cursor.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }),
      pct: pct(cursor),
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  const today    = new Date();
  const todayPct = pct(today);
  const showToday = todayPct >= 0 && todayPct <= 100;

  // ── Drag logic ────────────────────────────────────────────────────────────

  /**
   * Generic drag handler.
   *  onDelta(deltaDays) — called on every mouse move
   *  onCommit(deltaDays) — called on mouse up
   */
  const startDrag = (e, onDelta, onCommit) => {
    e.preventDefault();
    const startX    = e.clientX;
    let   lastDelta = 0;

    const onMove = (mv) => {
      const delta = pxToDays(mv.clientX - startX);
      if (delta !== lastDelta) { onDelta(delta); lastDelta = delta; }
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
      onCommit(lastDelta);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  };

  // Sprint — move (shift both dates)
  const onSprintMoveStart = (e, sprint) => {
    const origStart = sprint.start_date;
    const origEnd   = sprint.end_date;
    startDrag(
      e,
      (d) => setSprints((prev) => prev.map((s) => s.id === sprint.id
        ? { ...s, start_date: toISO(addDays(origStart, d)), end_date: toISO(addDays(origEnd, d)) }
        : s
      )),
      (d) => {
        if (!d) return;
        const newStart = toISO(addDays(origStart, d));
        const newEnd   = toISO(addDays(origEnd, d));
        setDirty((prev) => ({ ...prev, sprints: { ...prev.sprints, [sprint.id]: { start_date: newStart, end_date: newEnd } } }));
      }
    );
  };

  // Sprint — resize (shift end_date only)
  const onSprintResizeStart = (e, sprint) => {
    e.stopPropagation();
    const origEnd = sprint.end_date;
    startDrag(
      e,
      (d) => setSprints((prev) => prev.map((s) => s.id === sprint.id
        ? { ...s, end_date: toISO(addDays(origEnd, Math.max(0, d))) }
        : s
      )),
      (d) => {
        if (!d) return;
        const newEnd = toISO(addDays(origEnd, Math.max(0, d)));
        setDirty((prev) => ({ ...prev, sprints: { ...prev.sprints, [sprint.id]: { ...prev.sprints[sprint.id], end_date: newEnd } } }));
      }
    );
  };

  // Task — move due_date
  const onTaskMoveStart = (e, task) => {
    const orig = task.due_date;
    startDrag(
      e,
      (d) => setTasks((prev) => prev.map((t) => t.id === task.id
        ? { ...t, due_date: toISO(addDays(orig, d)) }
        : t
      )),
      (d) => {
        if (!d) return;
        const newDate = toISO(addDays(orig, d));
        setDirty((prev) => ({ ...prev, tasks: { ...prev.tasks, [task.id]: { due_date: newDate } } }));
      }
    );
  };

  // Milestone — move due_date
  const onMilestoneMoveStart = (e, ms) => {
    const orig = ms.due_date;
    startDrag(
      e,
      (d) => setMilestones((prev) => prev.map((m) => m.id === ms.id
        ? { ...m, due_date: toISO(addDays(orig, d)) }
        : m
      )),
      (d) => {
        if (!d) return;
        const newDate = toISO(addDays(orig, d));
        setDirty((prev) => ({ ...prev, milestones: { ...prev.milestones, [ms.id]: { due_date: newDate } } }));
      }
    );
  };

  // ── Save pending changes ─────────────────────────────────────────────────

  const hasDirty =
    Object.keys(dirty.sprints).length   > 0 ||
    Object.keys(dirty.tasks).length     > 0 ||
    Object.keys(dirty.milestones).length > 0;

  const saveAll = async () => {
    setSaving(true);
    try {
      const calls = [
        ...Object.entries(dirty.sprints).map(([id, d]) => projectsAPI.updateSprint(id, d)),
        ...Object.entries(dirty.tasks).map(([id, d]) => projectsAPI.updateTask(id, d)),
        ...Object.entries(dirty.milestones).map(([id, d]) => projectsAPI.updateMilestone(id, d)),
      ];
      await Promise.all(calls);
      setDirty({ sprints: {}, tasks: {}, milestones: {} });
      toast.success('Cambios guardados');
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const discardAll = () => {
    setDirty({ sprints: {}, tasks: {}, milestones: {} });
    // Reload from server
    setLoading(true);
    Promise.all([
      projectsAPI.getSprints(projectId),
      projectsAPI.getMilestones(projectId),
      projectsAPI.getTasks({ project_id: projectId, per_page: 200 }),
    ]).then(([sp, ml, tk]) => {
      setSprints(sp.data ?? []);
      setMilestones(ml.data ?? []);
      setTasks((tk.data?.data ?? tk.data ?? []).filter((t) => !t.parent_task_id));
    }).catch(() => {}).finally(() => setLoading(false));
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const rowHt = 'h-10 mb-2';

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden select-none">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3 flex-wrap">
        <Calendar size={18} className="text-indigo-500" />
        <h3 className="font-semibold text-slate-700 dark:text-slate-200">Línea de Tiempo</h3>
        <span className="text-xs text-slate-400">{fmt(baseMin)} → {fmt(baseMax)} ({totalDays} días)</span>

        {/* Dirty badge */}
        {hasDirty && (
          <div className="flex items-center gap-2 ml-2">
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              {Object.keys(dirty.sprints).length + Object.keys(dirty.tasks).length + Object.keys(dirty.milestones).length} cambio(s) sin guardar
            </span>
            <button
              onClick={saveAll}
              disabled={saving}
              className="flex items-center gap-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-lg transition-colors disabled:opacity-60"
            >
              <Save size={11} /> {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={discardAll} className="text-xs text-slate-400 hover:text-slate-600 underline">Descartar</button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setViewMode('sprint')}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${viewMode === 'sprint' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400'}`}>
            Sprints
          </button>
          <button onClick={() => setViewMode('task')}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${viewMode === 'task' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400'}`}>
            Tareas
          </button>
          <button onClick={() => setDayOffset((d) => d - 14)} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><ChevronLeft size={15} /></button>
          <button onClick={() => setDayOffset(0)} className="text-xs text-indigo-600 hover:underline">Hoy</button>
          <button onClick={() => setDayOffset((d) => d + 14)} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><ChevronRight size={15} /></button>
        </div>
      </div>

      <div className="p-5 overflow-x-auto">
        <div className="min-w-[600px]">

          {/* Month markers */}
          <div className="relative h-6 mb-2">
            {months.map((m, i) => (
              <div key={i} className="absolute top-0 flex flex-col items-start" style={{ left: `${m.pct}%` }}>
                <div className="h-full w-px bg-slate-200 dark:bg-slate-600" />
                <span className="text-xs text-slate-400 whitespace-nowrap mt-0.5 -ml-4">{m.label}</span>
              </div>
            ))}
          </div>

          {/* Today line */}
          {showToday && (
            <div className="relative" style={{ height: 0 }}>
              <div className="absolute top-0 w-0.5 bg-red-400 z-10 pointer-events-none"
                style={{ left: `${todayPct}%`, height: `${(sprints.length + milestones.length + 2) * 48}px` }}>
                <span className="absolute -top-5 -translate-x-1/2 text-xs text-red-500 font-semibold bg-white dark:bg-slate-800 px-1 border border-red-200 rounded">
                  Hoy
                </span>
              </div>
            </div>
          )}

          {/* Track — used to calculate pixel-to-days ratio */}
          <div ref={trackRef}>

            {/* Project bar */}
            {project?.planned_start_date && project?.planned_end_date && (
              <div className={`relative ${rowHt} flex items-center`}>
                <div className="w-28 flex-shrink-0 text-xs font-semibold text-slate-500 truncate pr-2">Proyecto</div>
                <div className="flex-1 relative h-5">
                  <div className="absolute h-full rounded-full bg-indigo-200 opacity-60 border border-indigo-300"
                    style={{ left: `${pct(project.planned_start_date)}%`, width: `${width(project.planned_start_date, project.planned_end_date)}%` }}>
                    <div className="h-full rounded-full bg-indigo-500 opacity-40" style={{ width: `${project.completion_percentage || 0}%` }} />
                  </div>
                </div>
              </div>
            )}

            {/* ── Sprints ─────────────────────────────────────────────── */}
            {viewMode === 'sprint' && sprints.length > 0 && (
              <>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 pl-28">Sprints</p>
                {sprints.map((s, idx) => {
                  const isDirty = !!dirty.sprints[s.id];
                  const color   = SPRINT_COLORS[idx % SPRINT_COLORS.length];
                  return (
                    <div key={s.id} className={`relative ${rowHt} flex items-center group`}>
                      <div className="w-28 flex-shrink-0 text-xs text-slate-600 dark:text-slate-300 truncate pr-2 font-medium" title={s.name}>
                        <div className="flex items-center gap-1">
                          <Zap size={11} className="text-indigo-400 flex-shrink-0" />
                          <span className="truncate">{s.name}</span>
                          {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" title="Sin guardar" />}
                        </div>
                        <span className={`text-xs ml-3 ${s.status === 'ACTIVO' ? 'text-emerald-600' : s.status === 'CERRADO' ? 'text-slate-400' : 'text-slate-500'}`}>
                          {s.status}
                        </span>
                      </div>
                      <div className="flex-1 relative h-7">
                        <div
                          className="absolute h-full rounded-lg flex items-center px-2 text-white text-xs font-medium overflow-visible cursor-grab active:cursor-grabbing transition-shadow hover:shadow-lg"
                          style={{
                            left:    `${pct(s.start_date)}%`,
                            width:   `${Math.max(2, width(s.start_date, s.end_date))}%`,
                            background: color,
                            opacity: s.status === 'CERRADO' ? 0.5 : 1,
                            outline: isDirty ? '2px solid #f59e0b' : 'none',
                          }}
                          onMouseDown={(e) => onSprintMoveStart(e, s)}
                        >
                          <span className="truncate select-none">{fmt(s.start_date)} – {fmt(s.end_date)}</span>

                          {/* Resize handle */}
                          <div
                            className="absolute right-0 top-0 h-full w-2.5 cursor-col-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            onMouseDown={(e) => onSprintResizeStart(e, s)}
                            title="Arrastrar para redimensionar"
                          >
                            <div className="w-0.5 h-4 bg-white/60 rounded" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* ── Tasks ───────────────────────────────────────────────── */}
            {viewMode === 'task' && tasks.filter((t) => t.due_date).length > 0 && (
              <>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 pl-28">Tareas</p>
                {tasks.filter((t) => t.due_date).map((t) => {
                  const isDirty = !!dirty.tasks[t.id];
                  const color   = PRIORITY_COLORS[t.priority] || '#94a3b8';
                  return (
                    <div key={t.id} className={`relative ${rowHt} flex items-center group`}>
                      <div className="w-28 flex-shrink-0 text-xs text-slate-600 dark:text-slate-300 truncate pr-2" title={t.title}>
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                          <span className="truncate">{t.title}</span>
                          {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />}
                        </div>
                        <span className="text-[10px] text-slate-400 ml-4">{t.status?.replace('_',' ')}</span>
                      </div>
                      <div className="flex-1 relative h-6">
                        {/* Draggable marker */}
                        <div
                          className="absolute flex items-center cursor-grab active:cursor-grabbing"
                          style={{ left: `calc(${pct(t.due_date)}% - 6px)`, top: '50%', transform: 'translateY(-50%)' }}
                          onMouseDown={(e) => onTaskMoveStart(e, t)}
                          title={`${t.title} — ${fmt(t.due_date)}\nArrastrar para cambiar fecha`}
                        >
                          <div className="w-3 h-3 rounded-sm rotate-45 border-2 border-white shadow hover:scale-125 transition-transform"
                            style={{ background: color, opacity: t.status === 'COMPLETADA' ? 0.5 : 1 }} />
                        </div>
                        <span className="absolute text-[10px] text-slate-400 whitespace-nowrap pointer-events-none"
                          style={{ left: `calc(${pct(t.due_date)}% + 10px)`, top: '50%', transform: 'translateY(-50%)' }}>
                          {fmt(t.due_date)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* ── Milestones ──────────────────────────────────────────── */}
            {milestones.length > 0 && (
              <>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mt-4 mb-2 pl-28">Hitos</p>
                {milestones.map((m) => {
                  const isOverdue = !m.is_completed && new Date(m.due_date) < today;
                  const isDirty   = !!dirty.milestones[m.id];
                  const color = m.is_completed ? MILESTONE_COLORS.completed
                              : isOverdue      ? MILESTONE_COLORS.overdue
                              : MILESTONE_COLORS.pending;
                  return (
                    <div key={m.id} className={`relative ${rowHt} flex items-center group`}>
                      <div className="w-28 flex-shrink-0 text-xs text-slate-600 dark:text-slate-300 truncate pr-2" title={m.title}>
                        <div className="flex items-center gap-1">
                          {m.is_completed
                            ? <CheckCircle2 size={11} className="text-emerald-500 flex-shrink-0" />
                            : <Flag size={11} className={`flex-shrink-0 ${isOverdue ? 'text-red-400' : 'text-indigo-400'}`} />
                          }
                          <span className="truncate">{m.title}</span>
                          {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />}
                        </div>
                      </div>
                      <div className="flex-1 relative h-7 flex items-center">
                        {/* Draggable diamond */}
                        <div
                          className="absolute flex items-center justify-center cursor-grab active:cursor-grabbing"
                          style={{ left: `calc(${pct(m.due_date)}% - 10px)`, top: '50%', transform: 'translateY(-50%)' }}
                          onMouseDown={(e) => onMilestoneMoveStart(e, m)}
                          title={`${m.title} — ${fmt(m.due_date)}\nArrastrar para cambiar fecha`}
                        >
                          <div className="w-5 h-5 rotate-45 rounded-sm border-2 border-white shadow hover:scale-125 transition-transform"
                            style={{ background: color, outline: isDirty ? '2px solid #f59e0b' : 'none' }} />
                        </div>
                        <span className="absolute text-xs whitespace-nowrap pointer-events-none"
                          style={{ left: `calc(${pct(m.due_date)}% + 14px)`, color }}>
                          {fmt(m.due_date)}
                          {isOverdue && ' ⚠️'}
                          {m.is_completed && ' ✓'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>{/* /trackRef */}
        </div>
      </div>

      {/* Legend */}
      <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-indigo-500" /> Sprints (arrastrar para mover / handle derecho para redimensionar)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rotate-45 bg-emerald-500 inline-block" /> Hito completado</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rotate-45 bg-indigo-500 inline-block" /> Hito pendiente</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rotate-45 bg-red-500 inline-block" /> Hito vencido</span>
        {showToday && <span className="flex items-center gap-1.5"><span className="w-0.5 h-3 bg-red-400 inline-block" /> Hoy</span>}
      </div>
    </div>
  );
}
