import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { projectsAPI } from '../services/projectsAPI';
import Layout from '../components/Layout';
import { toast } from 'sonner';
import {
  CheckCircle2, Clock, AlertTriangle, Zap, FolderKanban,
  TrendingUp, ListTodo, ChevronRight, Activity, Users,
  CalendarDays, Flag, BarChart2, ArrowRight, Circle, PieChart as PieIcon,
  LayoutDashboard, X,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

// ── Constantes ──────────────────────────────────────────────────────────────
const STATUS_ACCENT = {
  INICIACION:    { bar: 'bg-indigo-500',  text: 'text-indigo-600',  badge: 'bg-indigo-100 text-indigo-700'  },
  PLANIFICACION: { bar: 'bg-violet-500',  text: 'text-violet-600',  badge: 'bg-violet-100 text-violet-700'  },
  EJECUCION:     { bar: 'bg-blue-500',    text: 'text-blue-600',    badge: 'bg-blue-100 text-blue-700'      },
  MONITOREO:     { bar: 'bg-amber-500',   text: 'text-amber-600',   badge: 'bg-amber-100 text-amber-700'    },
  CIERRE:        { bar: 'bg-emerald-500', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700'},
  PAUSADO:       { bar: 'bg-slate-400',   text: 'text-slate-500',   badge: 'bg-slate-100 text-slate-600'    },
  CANCELADO:     { bar: 'bg-red-400',     text: 'text-red-500',     badge: 'bg-red-100 text-red-600'        },
};
const STATUS_LABEL = {
  INICIACION: 'Iniciación', PLANIFICACION: 'Planificación', EJECUCION: 'Ejecución',
  MONITOREO: 'Monitoreo', CIERRE: 'Cierre', PAUSADO: 'Pausado', CANCELADO: 'Cancelado',
};
const PRIORITY_STYLE = {
  CRITICA: { dot: 'bg-red-500',    badge: 'bg-red-100 text-red-700',       label: 'Crítica'  },
  ALTA:    { dot: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-700',   label: 'Alta'     },
  MEDIA:   { dot: 'bg-blue-400',   badge: 'bg-blue-100 text-blue-700',     label: 'Media'    },
  BAJA:    { dot: 'bg-slate-300',  badge: 'bg-slate-100 text-slate-600',   label: 'Baja'     },
};
const TASK_STATUS_STYLE = {
  PENDIENTE:   { dot: 'bg-slate-400', label: 'Pendiente'   },
  EN_PROGRESO: { dot: 'bg-blue-500',  label: 'En Progreso' },
  BLOQUEADA:   { dot: 'bg-red-500',   label: 'Bloqueada'   },
  COMPLETADA:  { dot: 'bg-emerald-500', label: 'Completada' },
};
const AVATAR_COLORS = [
  'bg-indigo-500','bg-violet-500','bg-blue-500','bg-emerald-500',
  'bg-amber-500', 'bg-rose-500',  'bg-teal-500','bg-cyan-500',
];
const ACTION_ICON = {
  'task.created':        { icon: ListTodo,      color: 'text-blue-500'    },
  'task.status_changed': { icon: CheckCircle2,  color: 'text-emerald-500' },
  'risk.created':        { icon: AlertTriangle, color: 'text-amber-500'   },
  'sprint.created':      { icon: Flag,          color: 'text-indigo-500'  },
  'project.created':     { icon: FolderKanban,  color: 'text-violet-500'  },
};

function avatarInitials(user) {
  if (!user) return '?';
  const fn = user.first_name || '';
  const ln = user.last_name  || '';
  return (fn[0] || '') + (ln[0] || '') || (user.username?.[0] || '?');
}
function greet(name) {
  const h = new Date().getHours();
  const g = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  return `${g}, ${name} 👋`;
}
function daysLeft(dateStr) {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr + 'T12:00:00') - new Date()) / 86400000);
  return diff;
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}
function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)   return 'Hace un momento';
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
  return `Hace ${Math.floor(diff / 86400)}d`;
}

// ── Sub-components ───────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = 'bg-indigo-500', textColor = 'text-indigo-600' }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 flex items-center gap-3">
      <div className={`${color} p-2.5 rounded-lg text-white flex-shrink-0`}><Icon size={18} /></div>
      <div className="min-w-0">
        <p className={`text-xl font-bold ${textColor} dark:text-slate-100`}>{value ?? 0}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function AlertBanner({ alerts }) {
  const [dismissed, setDismissed] = useState([]);
  if (!alerts?.length) return null;
  const visible = alerts.filter((_, i) => !dismissed.includes(i));
  if (!visible.length) return null;

  const severityStyles = {
    error:   'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
    warning: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800',
  };
  const iconStyles = { error: 'text-red-500', warning: 'text-amber-500' };

  return (
    <div className="space-y-2">
      {alerts.map((a, i) => dismissed.includes(i) ? null : (
        <div key={i}
          className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${severityStyles[a.severity] || severityStyles.warning}`}>
          <AlertTriangle size={15} className={`flex-shrink-0 mt-0.5 ${iconStyles[a.severity] || iconStyles.warning}`} />
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-slate-800 dark:text-slate-100">{a.title}:</span>{' '}
            <span className="text-slate-600 dark:text-slate-300">{a.body}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {a.link && (
              <Link to={a.link} className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 whitespace-nowrap">
                Ver →
              </Link>
            )}
            <button onClick={() => setDismissed(p => [...p, i])}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold">✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProjectMiniCard({ project }) {
  const accent = STATUS_ACCENT[project.status] ?? STATUS_ACCENT.EJECUCION;
  const days   = daysLeft(project.planned_end_date);
  const pct    = Math.min(100, Math.max(0, project.completion_percentage ?? 0));

  let daysBadge = null;
  if (days !== null) {
    if (days < 0)      daysBadge = <span className="text-xs font-medium text-red-600">Vencido</span>;
    else if (days <= 7) daysBadge = <span className="text-xs font-medium text-amber-600">{days}d</span>;
    else                daysBadge = <span className="text-xs text-slate-400">{days}d</span>;
  }

  return (
    <Link to={`/projects/${project.id}`}
      className="group block bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700
                 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 overflow-hidden">
      {/* Progress bar top */}
      <div className="h-1 bg-slate-100 dark:bg-slate-700">
        <div className={`h-full ${accent.bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-xs font-mono text-slate-400">{project.project_code ?? project.code}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${accent.badge}`}>
            {STATUS_LABEL[project.status] ?? project.status}
          </span>
        </div>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 line-clamp-1 transition-colors">
          {project.name}
        </p>
        {project.category_name && (
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: project.category_color || '#6366f1' }} />
            <p className="text-xs text-slate-400 truncate">{project.category_name}</p>
          </div>
        )}
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-slate-500">{pct}% completado</span>
          {daysBadge}
        </div>
      </div>
    </Link>
  );
}

function TaskRow({ task, onStatusChange, updating }) {
  const today  = new Date().toISOString().slice(0, 10);
  const isOver = task.due_date && task.due_date < today;
  const p      = PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.BAJA;
  const s      = TASK_STATUS_STYLE[task.status] ?? TASK_STATUS_STYLE.PENDIENTE;

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border transition-colors
      ${isOver ? 'border-red-100 bg-red-50/50 dark:bg-red-900/10 dark:border-red-900/30'
               : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>

      {/* Priority dot */}
      <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${p.dot}`} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 line-clamp-1">{task.title}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-slate-400">{task.project_code}</span>
          {task.due_date && (
            <span className={`text-xs ${isOver ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
              {isOver ? '⚠ ' : ''}{fmtDate(task.due_date)}
            </span>
          )}
          <span className={`flex items-center gap-1 text-xs`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            <span className="text-slate-400">{s.label}</span>
          </span>
        </div>
      </div>

      {/* Quick complete */}
      {task.status !== 'COMPLETADA' && (
        <button
          disabled={updating === task.id}
          onClick={() => onStatusChange(task, 'COMPLETADA')}
          title="Marcar como completada"
          className="flex-shrink-0 w-7 h-7 rounded-full border-2 border-slate-300 dark:border-slate-600
                     hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20
                     flex items-center justify-center transition-colors group/btn">
          <CheckCircle2 size={14} className="text-slate-300 dark:text-slate-600 group-hover/btn:text-emerald-500 transition-colors" />
        </button>
      )}
    </div>
  );
}

// ── Chart helpers ────────────────────────────────────────────────────────────
const DONUT_COLORS = {
  CRITICA: '#ef4444', ALTA: '#f59e0b', MEDIA: '#6366f1', BAJA: '#94a3b8',
};
const DONUT_LABELS = { CRITICA: 'Crítica', ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja' };

function WeeklyHoursChart({ data }) {
  if (!data?.length) return null;
  const maxVal = Math.max(...data.map((d) => d.hours), 1);
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4">
      <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
        <Clock size={15} className="text-indigo-500" /> Horas registradas — últimos 7 días
      </h2>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}
            formatter={(v) => [`${v}h`, 'Horas']}
            labelFormatter={(l) => `Día: ${l}`}
          />
          <Bar dataKey="hours" fill="#6366f1" radius={[4, 4, 0, 0]}
            label={{ position: 'top', fontSize: 10, fill: '#6366f1', formatter: (v) => v > 0 ? `${v}h` : '' }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PriorityDonut({ dist }) {
  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const pieData = Object.entries(dist)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: DONUT_LABELS[k], value: v, key: k }));

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4">
      <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-2">
        <PieIcon size={15} className="text-indigo-500" /> Tareas por prioridad
      </h2>
      <div className="flex items-center gap-4">
        <ResponsiveContainer width="50%" height={140}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={38} outerRadius={58}
              dataKey="value" paddingAngle={3}>
              {pieData.map((entry) => (
                <Cell key={entry.key} fill={DONUT_COLORS[entry.key]} />
              ))}
            </Pie>
            <Tooltip formatter={(v, name) => [`${v} tareas`, name]}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex-1 space-y-1.5">
          {pieData.map((entry) => (
            <div key={entry.key} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: DONUT_COLORS[entry.key] }} />
                <span className="text-slate-600 dark:text-slate-300">{entry.name}</span>
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">{entry.value}</span>
            </div>
          ))}
          <div className="border-t border-slate-100 dark:border-slate-700 pt-1.5 flex items-center justify-between text-xs">
            <span className="text-slate-400">Total activas</span>
            <span className="font-bold text-slate-800 dark:text-slate-100">{total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectProgressBars({ projects }) {
  if (!projects?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4">
      <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
        <BarChart2 size={15} className="text-indigo-500" /> Avance de proyectos
      </h2>
      <div className="space-y-3">
        {projects.map((p) => (
          <div key={p.id}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[60%]">
                <span className="text-slate-400 font-mono mr-1">{p.code}</span>{p.name}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-slate-400">{p.done}/{p.total}</span>
                <span className={`font-bold ${p.pct >= 75 ? 'text-emerald-600' : p.pct >= 40 ? 'text-blue-600' : 'text-amber-600'}`}>
                  {p.pct}%
                </span>
              </div>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                style={{ width: `${p.pct}%` }} />
              <div className="h-full bg-blue-400 transition-all duration-700"
                style={{ width: `${p.total > 0 ? (p.in_progress / p.total) * 100 : 0}%` }} />
              <div className="h-full bg-red-400 transition-all duration-700"
                style={{ width: `${p.total > 0 ? (p.blocked / p.total) * 100 : 0}%` }} />
            </div>
          </div>
        ))}
        <div className="flex items-center gap-3 pt-1 text-xs text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Completadas</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" />En progreso</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" />Bloqueadas</span>
        </div>
      </div>
    </div>
  );
}

const AVATAR_BAR_COLORS = ['#6366f1','#8b5cf6','#3b82f6','#10b981','#f59e0b','#ec4899','#06b6d4','#84cc16'];

function TeamStatsChart({ team }) {
  if (!team?.length) return null;
  const chartData = team.map((u) => ({
    name: u.full_name?.trim() || u.username,
    asignadas:  u.tasks_assigned,
    completadas: u.tasks_done,
    horas:      u.hours_week,
  }));
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4">
      <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
        <Users size={15} className="text-indigo-500" /> Carga de equipo — sprint activo
      </h2>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={90}
            tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
            formatter={(v, name) => [v, name === 'asignadas' ? 'Asignadas' : name === 'completadas' ? 'Completadas' : 'Horas semana']}
          />
          <Bar dataKey="asignadas"   name="asignadas"   fill="#6366f1" radius={[0,4,4,0]} barSize={7} />
          <Bar dataKey="completadas" name="completadas" fill="#10b981" radius={[0,4,4,0]} barSize={7} />
        </BarChart>
      </ResponsiveContainer>
      {/* Horas row */}
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {team.slice(0, 6).map((u, i) => u.hours_week > 0 && (
          <div key={u.id} className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: AVATAR_BAR_COLORS[i % AVATAR_BAR_COLORS.length] }} />
            <span className="text-slate-500 truncate">{u.full_name?.split(' ')[0] || u.username}</span>
            <span className="ml-auto font-medium text-slate-700 dark:text-slate-300">{u.hours_week}h</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Widget definitions ───────────────────────────────────────────────────────
const WIDGET_DEFS = [
  { id: 'stats',        label: 'Tarjetas KPI',       defaultOn: true  },
  { id: 'urgent_tasks', label: 'Tareas urgentes',    defaultOn: true  },
  { id: 'projects',     label: 'Mis proyectos',      defaultOn: true  },
  { id: 'activity',     label: 'Actividad reciente', defaultOn: true  },
  { id: 'charts',       label: 'Gráficas',           defaultOn: true  },
];
const DEFAULT_WIDGETS = Object.fromEntries(WIDGET_DEFS.map(w => [w.id, w.defaultOn]));

// ── Main component ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user }     = useAuthStore();
  const navigate     = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [widgets, setWidgets]   = useState(DEFAULT_WIDGETS);
  const [showWidgetPanel, setShowWidgetPanel] = useState(false);
  const [savingWidgets, setSavingWidgets]     = useState(false);

  const load = () => {
    setLoading(true);
    projectsAPI.getDashboard()
      .then((r) => setData(r.data))
      .catch(() => toast.error('Error al cargar el dashboard'))
      .finally(() => setLoading(false));
  };

  const loadWidgets = () => {
    projectsAPI.getDashboardWidgets()
      .then(r => {
        const saved = r.data ?? [];
        if (saved.length > 0) {
          const map = { ...DEFAULT_WIDGETS };
          saved.forEach(w => { if (w.widget_id in map) map[w.widget_id] = !!w.is_visible; });
          setWidgets(map);
        }
      })
      .catch(() => {}); // silent — fallback to defaults
  };

  const saveWidgets = async () => {
    setSavingWidgets(true);
    try {
      const payload = Object.entries(widgets).map(([widget_id, is_visible], position) => ({
        widget_id, is_visible, position,
      }));
      await projectsAPI.saveDashboardWidgets(payload);
      toast.success('Dashboard personalizado guardado');
      setShowWidgetPanel(false);
    } catch { toast.error('Error al guardar preferencias'); }
    finally { setSavingWidgets(false); }
  };

  useEffect(() => { load(); loadWidgets(); }, []);

  const changeStatus = async (task, newStatus) => {
    setUpdating(task.id);
    try {
      await projectsAPI.updateTask(task.id, { status: newStatus });
      toast.success('Tarea completada ✓');
      load();
    } catch { toast.error('Error al actualizar'); }
    finally  { setUpdating(null); }
  };

  const firstName = user?.first_name || user?.username || 'Usuario';
  const avatarColor = AVATAR_COLORS[(user?.id ?? 0) % AVATAR_COLORS.length];
  const initials    = avatarInitials(user);

  // ── Skeleton ──
  if (loading) return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-6 animate-pulse">
        <div className="h-24 bg-slate-200 dark:bg-slate-700 rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-slate-200 dark:bg-slate-700 rounded-xl" />)}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="h-72 bg-slate-200 dark:bg-slate-700 rounded-xl" />
          <div className="h-72 bg-slate-200 dark:bg-slate-700 rounded-xl" />
        </div>
      </div>
    </Layout>
  );

  const ts              = data?.tasks_summary      ?? {};
  const tasks           = data?.urgent_tasks       ?? [];
  const projects        = data?.my_projects        ?? [];
  const alerts          = data?.alerts             ?? [];
  const activity        = data?.recent_activity    ?? [];
  const hoursW          = data?.hours_this_week    ?? 0;
  const completedW      = data?.completed_week     ?? 0;
  const hoursPerDay     = data?.hours_per_day      ?? [];
  const priorityDist    = data?.priority_dist      ?? {};
  const projectProgress = data?.project_progress   ?? [];
  const teamStats       = data?.team_stats         ?? [];
  const isManager       = data?.is_manager         ?? false;

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-6">

        {/* ── Widget customizer panel ────────────────────────────────── */}
        {showWidgetPanel && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <LayoutDashboard size={14} className="text-indigo-500" /> Personalizar dashboard
              </h3>
              <button onClick={() => setShowWidgetPanel(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {WIDGET_DEFS.map(w => (
                <label key={w.id} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                  <input type="checkbox" checked={!!widgets[w.id]} onChange={e => setWidgets(prev => ({ ...prev, [w.id]: e.target.checked }))}
                    className="accent-indigo-600" />
                  {w.label}
                </label>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={saveWidgets} disabled={savingWidgets}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
                {savingWidgets ? 'Guardando…' : 'Guardar preferencias'}
              </button>
              <button onClick={() => { setWidgets(DEFAULT_WIDGETS); }}
                className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
                Restaurar
              </button>
            </div>
          </div>
        )}

        {/* ── Hero greeting ──────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 dark:from-indigo-700 dark:to-violet-800 rounded-2xl p-5 sm:p-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">{greet(firstName)}</h1>
            <p className="text-indigo-200 text-sm mt-1">
              {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              {ts.en_progreso > 0 && (
                <span className="flex items-center gap-1.5 text-xs text-indigo-100">
                  <Zap size={12} className="text-yellow-300" />
                  {ts.en_progreso} tarea{ts.en_progreso !== 1 ? 's' : ''} en progreso
                </span>
              )}
              {hoursW > 0 && (
                <span className="flex items-center gap-1.5 text-xs text-indigo-100">
                  <Clock size={12} />
                  {hoursW}h esta semana
                </span>
              )}
              {completedW > 0 && (
                <span className="flex items-center gap-1.5 text-xs text-indigo-100">
                  <CheckCircle2 size={12} className="text-emerald-300" />
                  {completedW} completada{completedW !== 1 ? 's' : ''} esta semana
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className={`${avatarColor} w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
              {initials.toUpperCase()}
            </div>
            <button
              onClick={() => setShowWidgetPanel(p => !p)}
              title="Personalizar dashboard"
              className="flex items-center gap-1 text-[10px] text-indigo-200 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg px-2 py-1 transition-colors">
              <LayoutDashboard size={11} /> Personalizar
            </button>
          </div>
        </div>

        {/* ── Alerts ─────────────────────────────────────────────────── */}
        {alerts.length > 0 && <AlertBanner alerts={alerts} />}

        {/* ── KPI strip ──────────────────────────────────────────────── */}
        {widgets.stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={ListTodo}     label="Tareas activas"   value={ts.total}       color="bg-indigo-500" textColor="text-indigo-600" />
          <StatCard icon={Zap}          label="En progreso"      value={ts.en_progreso} color="bg-blue-500"   textColor="text-blue-600" />
          <StatCard icon={AlertTriangle}label="Bloqueadas"       value={ts.bloqueada}   color="bg-red-400"    textColor="text-red-600"
            sub={ts.overdue > 0 ? `${ts.overdue} vencida${ts.overdue !== 1 ? 's' : ''}` : undefined} />
          <StatCard icon={FolderKanban} label="Proyectos activos" value={projects.length} color="bg-emerald-500" textColor="text-emerald-600" />
        </div>
        )}

        {/* ── Two-column body ────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-5 gap-6">

          {/* ── Left: Mis tareas urgentes ─────── (col 3/5) */}
          <div className="lg:col-span-3 space-y-4">
            {widgets.urgent_tasks && <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm">
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <ListTodo size={15} className="text-indigo-500" /> Mis tareas urgentes
                </h2>
                <Link to="/my-tasks" className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                  Ver todas <ArrowRight size={12} />
                </Link>
              </div>
              <div className="px-3 pb-3 space-y-2">
                {tasks.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 size={28} className="text-emerald-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">¡Sin tareas pendientes!</p>
                    <p className="text-xs text-slate-400 mt-0.5">Estás al día con todo.</p>
                  </div>
                ) : (
                  tasks.map((t) => (
                    <TaskRow key={t.id} task={t} onStatusChange={changeStatus} updating={updating} />
                  ))
                )}
              </div>
              {tasks.length > 0 && (
                <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-2.5">
                  <Link to="/my-tasks"
                    className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                    Ver las {ts.total} tareas activas <ChevronRight size={12} />
                  </Link>
                </div>
              )}
            </div>}

            {/* ── Mis proyectos ─── */}
            {widgets.projects && <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm">
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <FolderKanban size={15} className="text-indigo-500" /> Mis proyectos activos
                </h2>
                <Link to="/projects" className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                  Ver todos <ArrowRight size={12} />
                </Link>
              </div>
              <div className="px-3 pb-3">
                {projects.length === 0 ? (
                  <div className="text-center py-8">
                    <FolderKanban size={28} className="text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Sin proyectos activos asignados</p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {projects.map((p) => <ProjectMiniCard key={p.id} project={p} />)}
                  </div>
                )}
              </div>
            </div>}
          </div>

          {/* ── Right: actividad reciente ──── (col 2/5) */}
          <div className="lg:col-span-2 space-y-4">

            {/* Quick actions */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3">Accesos rápidos</h2>
              <div className="space-y-2">
                {[
                  { label: 'Mis Tareas',   to: '/my-tasks',  icon: ListTodo,    color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' },
                  { label: 'Proyectos',    to: '/projects',  icon: FolderKanban, color: 'text-violet-500 bg-violet-50 dark:bg-violet-900/20' },
                  { label: 'Calendario',   to: '/calendar',  icon: CalendarDays, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' },
                  { label: 'Reportes',     to: '/reports',   icon: BarChart2,    color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' },
                ].map(({ label, to, icon: Icon, color }) => (
                  <Link key={to} to={to}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                      <Icon size={15} />
                    </span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {label}
                    </span>
                    <ChevronRight size={13} className="ml-auto text-slate-300 group-hover:text-indigo-400 transition-colors" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Actividad reciente */}
            {widgets.activity && <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm">
              <div className="px-4 pt-4 pb-2">
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Activity size={15} className="text-indigo-500" /> Actividad reciente
                </h2>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {activity.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">Sin actividad reciente</p>
                ) : (
                  activity.map((a, i) => {
                    const ai = ACTION_ICON[a.action] ?? { icon: Circle, color: 'text-slate-400' };
                    const IconC = ai.icon;
                    return (
                      <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <IconC size={14} className={`flex-shrink-0 mt-0.5 ${ai.color}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2">{a.description}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-xs text-indigo-500 font-medium">{a.project_code}</span>
                            <span className="text-slate-300">·</span>
                            <span className="text-xs text-slate-400">{timeAgo(a.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {activity.length > 0 && (
                <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-2.5">
                  <Link to="/projects" className="text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                    Ver proyectos <ChevronRight size={12} />
                  </Link>
                </div>
              )}
            </div>}

          </div>
        </div>

        {/* ── Sección de Gráficas ────────────────────────────────────── */}
        {widgets.charts && (hoursPerDay.length > 0 || projectProgress.length > 0) && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-indigo-500" />
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Estadísticas</h2>
            </div>

            {/* Fila 1: Horas semanales + Donut de prioridad */}
            <div className="grid lg:grid-cols-3 gap-4 mb-4">
              <div className="lg:col-span-2">
                <WeeklyHoursChart data={hoursPerDay} />
              </div>
              <div>
                <PriorityDonut dist={priorityDist} />
              </div>
            </div>

            {/* Fila 2: Avance proyectos + Equipo (managers) */}
            <div className={`grid gap-4 ${isManager && teamStats.length > 0 ? 'lg:grid-cols-2' : 'lg:grid-cols-1'}`}>
              <ProjectProgressBars projects={projectProgress} />
              {isManager && teamStats.length > 0 && <TeamStatsChart team={teamStats} />}
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
