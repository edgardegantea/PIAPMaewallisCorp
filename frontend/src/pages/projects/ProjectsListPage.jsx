import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { projectsAPI } from '../../services/projectsAPI';
import Layout from '../../components/Layout';
import { toast } from 'sonner';
import {
  Plus, Search, FolderKanban, Filter, X, Star, User,
  Calendar, TrendingUp, AlertTriangle, CheckCircle2, Upload,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import ProjectImportModal from '../../components/projects/ProjectImportModal';

// ─── Static maps ──────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  INICIACION:    'bg-indigo-100 text-indigo-700',
  PLANIFICACION: 'bg-purple-100 text-purple-700',
  EJECUCION:     'bg-blue-100 text-blue-700',
  MONITOREO:     'bg-amber-100 text-amber-700',
  CIERRE:        'bg-emerald-100 text-emerald-700',
  PAUSADO:       'bg-slate-100 text-slate-600',
  CANCELADO:     'bg-red-100 text-red-700',
};
const STATUS_LABELS = {
  INICIACION: 'Iniciación', PLANIFICACION: 'Planificación', EJECUCION: 'Ejecución',
  MONITOREO: 'Monitoreo', CIERRE: 'Cierre', PAUSADO: 'Pausado', CANCELADO: 'Cancelado',
};
const PRIORITY_COLORS = {
  BAJA:   'bg-slate-100 text-slate-500',
  MEDIA:  'bg-blue-100 text-blue-700',
  ALTA:   'bg-amber-100 text-amber-700',
  CRITICA:'bg-red-100 text-red-700',
};
const PRIORITY_LABELS = { BAJA: 'Baja', MEDIA: 'Media', ALTA: 'Alta', CRITICA: 'Crítica' };

const STATUS_ACCENT = {
  INICIACION:    { border: 'border-l-indigo-500',  bar: '#6366f1' },
  PLANIFICACION: { border: 'border-l-purple-500',  bar: '#a855f7' },
  EJECUCION:     { border: 'border-l-blue-500',    bar: '#3b82f6' },
  MONITOREO:     { border: 'border-l-amber-500',   bar: '#f59e0b' },
  CIERRE:        { border: 'border-l-emerald-500', bar: '#10b981' },
  PAUSADO:       { border: 'border-l-slate-300',   bar: '#cbd5e1' },
  CANCELADO:     { border: 'border-l-red-400',     bar: '#f87171' },
};

const STATUSES   = ['INICIACION','PLANIFICACION','EJECUCION','MONITOREO','CIERRE','PAUSADO','CANCELADO'];
const PRIORITIES = ['BAJA','MEDIA','ALTA','CRITICA'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const today = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };

function daysRemaining(endDate) {
  if (!endDate) return null;
  return Math.ceil((new Date(endDate) - today()) / 86_400_000);
}

// ─── ProjectCard ──────────────────────────────────────────────────────────────

function ProjectCard({ p, isFavorite, onToggleFavorite }) {
  const accent  = STATUS_ACCENT[p.status] ?? STATUS_ACCENT.EJECUCION;
  const daysLeft = daysRemaining(p.planned_end_date);
  const isOverdue = daysLeft !== null && daysLeft < 0 && !['CIERRE','CANCELADO'].includes(p.status);

  return (
    <Link
      to={`/projects/${p.id}`}
      className={`group relative bg-white dark:bg-slate-800 rounded-xl shadow-sm
        border border-transparent hover:border-slate-200 dark:hover:border-slate-600
        border-l-4 ${accent.border}
        hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col`}>

      <div className="p-5 flex flex-col flex-1">

        {/* ── Row 1: code + priority + star ── */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 tracking-wide">
            {p.code}
          </span>
          <div className="flex items-center gap-1.5">
            {p.priority && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide
                ${PRIORITY_COLORS[p.priority]}`}>
                {PRIORITY_LABELS[p.priority]}
              </span>
            )}
            <button
              onClick={(e) => onToggleFavorite(e, p.id)}
              className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}>
              <Star size={13} className={isFavorite
                ? 'fill-amber-400 text-amber-400'
                : 'text-slate-300 group-hover:text-slate-400'} />
            </button>
          </div>
        </div>

        {/* ── Status badge ── */}
        <span className={`self-start text-xs font-semibold px-2.5 py-0.5 rounded-full mb-2.5
          ${STATUS_COLORS[p.status]}`}>
          {STATUS_LABELS[p.status] || p.status}
        </span>

        {/* ── Project name ── */}
        <h3 className="font-bold text-slate-900 dark:text-slate-50 text-[15px] leading-snug
          line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400
          transition-colors mb-2 flex-1">
          {p.name}
        </h3>

        {/* ── Category ── */}
        {p.category_name && (
          <div className="flex items-center gap-1.5 mb-4">
            <span className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: p.category_color || '#94a3b8' }} />
            <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {p.category_name}
            </span>
          </div>
        )}

        {/* ── Progress bar ── */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Avance</span>
            <span className="font-bold text-slate-700 dark:text-slate-200">
              {p.completion_percentage ?? 0}%
            </span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${p.completion_percentage ?? 0}%`,
                background: accent.bar,
              }}
            />
          </div>
        </div>

        {/* ── Footer: director + dates + days remaining ── */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">

          {/* Director avatar + name */}
          <div className="flex items-center gap-2 min-w-0">
            {p.director_first_name ? (
              <>
                <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40
                  flex items-center justify-center text-[10px] font-bold
                  text-indigo-600 dark:text-indigo-300 flex-shrink-0">
                  {(p.director_first_name?.[0] ?? '')}{(p.director_last_name?.[0] ?? '')}
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[9rem]">
                  {p.director_first_name} {p.director_last_name}
                </span>
              </>
            ) : (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <User size={11} /> Sin director
              </span>
            )}
          </div>

          {/* Days remaining / overdue badge */}
          {daysLeft !== null && !['CANCELADO'].includes(p.status) && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
              p.status === 'CIERRE'      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
              : isOverdue                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
              : daysLeft <= 7            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
            }`}>
              {p.status === 'CIERRE' ? '✓ Cerrado'
                : isOverdue          ? `▲ ${Math.abs(daysLeft)}d vencido`
                : daysLeft === 0     ? 'Vence hoy'
                : `${daysLeft}d`}
            </span>
          )}
        </div>

      </div>
    </Link>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProjectsListPage() {
  const authUser = useAuthStore((s) => s.user);
  const canCreate  = authUser?.role !== 'TEAM_MEMBER';
  const isAdmin    = authUser?.role === 'ADMIN';

  // Load persisted filters from localStorage (lazy initializers)
  const loadFilter = (key, fallback) => {
    try { const v = JSON.parse(localStorage.getItem('project_filters') || '{}'); return v[key] ?? fallback; }
    catch { return fallback; }
  };

  const [projects,    setProjects]    = useState([]);
  const [categories,  setCategories]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState(() => loadFilter('search', ''));
  const [status,      setStatus]      = useState(() => loadFilter('status', ''));
  const [category,    setCategory]    = useState(() => loadFilter('category', ''));
  const [priority,    setPriority]    = useState(() => loadFilter('priority', ''));
  const [showFilters, setShowFilters] = useState(false);
  const [favorites,   setFavorites]   = useState(new Set());
  const [onlyFavs,    setOnlyFavs]    = useState(() => loadFilter('onlyFavs', false));
  const [onlyMine,    setOnlyMine]    = useState(() => loadFilter('onlyMine', false));
  const [myProjects,  setMyProjects]  = useState([]);
  const [showImport,  setShowImport]  = useState(false);

  // Persist filters whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('project_filters', JSON.stringify({ search, status, category, priority, onlyFavs, onlyMine }));
    } catch { /* ignore */ }
  }, [search, status, category, priority, onlyFavs, onlyMine]);

  useEffect(() => {
    projectsAPI.getCategories().then((r) => setCategories(r.data)).catch(() => {});
    projectsAPI.getFavorites().then((r) => {
      setFavorites(new Set((r.data || []).map(Number)));
    }).catch(() => {});
    projectsAPI.getMyProjects().then((r) => setMyProjects(r.data)).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (search)   params.search   = search;
    if (status)   params.status   = status;
    if (category) params.category = category;
    if (priority) params.priority = priority;

    projectsAPI.getProjects(Object.keys(params).length ? params : undefined)
      .then((r) => setProjects(r.data))
      .catch(() => toast.error('Error al cargar proyectos'))
      .finally(() => setLoading(false));
  }, [search, status, category, priority]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load]);

  const clearFilters = () => {
    setSearch(''); setStatus(''); setCategory(''); setPriority('');
    setOnlyFavs(false); setOnlyMine(false);
  };

  const toggleFavorite = async (e, projectId) => {
    e.preventDefault(); e.stopPropagation();
    try {
      const r = await projectsAPI.toggleFavorite(projectId);
      setFavorites((prev) => {
        const next = new Set(prev);
        r.data.is_favorite ? next.add(Number(projectId)) : next.delete(Number(projectId));
        return next;
      });
    } catch { toast.error('Error al actualizar favorito'); }
  };

  const hasFilters         = search || status || category || priority || onlyFavs || onlyMine;
  const activeFilterCount  = [status, category, priority].filter(Boolean).length
                           + (onlyFavs ? 1 : 0) + (onlyMine ? 1 : 0);

  const visibleProjects = useMemo(() => {
    let base = onlyMine ? myProjects : projects;
    if (onlyFavs) base = base.filter((p) => favorites.has(Number(p.id)));
    if (onlyMine) {
      const q = search.toLowerCase();
      if (q)        base = base.filter((p) => p.name.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q));
      if (status)   base = base.filter((p) => p.status   === status);
      if (category) base = base.filter((p) => String(p.category_id) === String(category));
      if (priority) base = base.filter((p) => p.priority === priority);
    }
    return base;
  }, [onlyMine, myProjects, projects, onlyFavs, favorites, search, status, category, priority]);

  // Stats computed from all loaded projects (not the filtered view)
  const allProjects = onlyMine ? myProjects : projects;
  const statsBase   = onlyFavs ? allProjects.filter((p) => favorites.has(Number(p.id))) : allProjects;
  const stats = useMemo(() => {
    const td = today();
    return {
      total:    statsBase.length,
      active:   statsBase.filter((p) => p.status === 'EJECUCION').length,
      closed:   statsBase.filter((p) => p.status === 'CIERRE').length,
      overdue:  statsBase.filter((p) =>
        p.planned_end_date &&
        new Date(p.planned_end_date) < td &&
        !['CIERRE','CANCELADO'].includes(p.status)
      ).length,
    };
  }, [statsBase]);

  return (
    <>
    <Layout>
      <div className="p-4 sm:p-6 space-y-5">

        {/* ── Page header ─────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Proyectos</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {visibleProjects.length} proyecto{visibleProjects.length !== 1 ? 's' : ''}
              {hasFilters ? ' · filtrados' : ''}
            </p>
          </div>
          {canCreate && (
            <div className="flex items-center gap-2">
              {isAdmin && (
                <button
                  onClick={() => setShowImport(true)}
                  className="flex items-center gap-2 border border-slate-200 dark:border-slate-600
                    hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300
                    font-medium px-4 py-2.5 rounded-lg transition-colors text-sm shadow-sm">
                  <Upload size={16} /> Importar CSV
                </button>
              )}
              <Link
                to="/projects/new"
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700
                  text-white font-semibold px-4 py-2.5 rounded-lg transition-colors text-sm shadow-sm">
                <Plus size={16} /> Nuevo Proyecto
              </Link>
            </div>
          )}
        </div>

        {/* ── Stats strip ─────────────────────────────────────── */}
        {!loading && allProjects.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: 'Total',
                value: stats.total,
                icon: FolderKanban,
                bg: 'bg-slate-50 dark:bg-slate-700/50',
                icon_color: 'text-slate-500',
                val_color: 'text-slate-800 dark:text-slate-100',
              },
              {
                label: 'En Ejecución',
                value: stats.active,
                icon: TrendingUp,
                bg: 'bg-blue-50 dark:bg-blue-900/20',
                icon_color: 'text-blue-500',
                val_color: 'text-blue-800 dark:text-blue-200',
              },
              {
                label: 'Cerrados',
                value: stats.closed,
                icon: CheckCircle2,
                bg: 'bg-emerald-50 dark:bg-emerald-900/20',
                icon_color: 'text-emerald-500',
                val_color: 'text-emerald-800 dark:text-emerald-200',
              },
              {
                label: 'Vencidos',
                value: stats.overdue,
                icon: AlertTriangle,
                bg: stats.overdue > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-slate-50 dark:bg-slate-700/50',
                icon_color: stats.overdue > 0 ? 'text-red-500' : 'text-slate-400',
                val_color: stats.overdue > 0 ? 'text-red-700 dark:text-red-300' : 'text-slate-700 dark:text-slate-300',
              },
            ].map(({ label, value, icon: Icon, bg, icon_color, val_color }) => (
              <div key={label} className={`${bg} rounded-xl px-4 py-3 flex items-center gap-3`}>
                <Icon size={18} className={`flex-shrink-0 ${icon_color}`} />
                <div>
                  <p className={`text-xl font-bold leading-none ${val_color}`}>{value}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Search + toolbar ────────────────────────────────── */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Buscar por nombre o código…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg
                pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500
                bg-white dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 border rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
              ${showFilters || activeFilterCount > 0
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-300'
                : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
            <Filter size={14} />
            Filtros
            {activeFilterCount > 0 && (
              <span className="bg-indigo-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setOnlyFavs((v) => !v)}
            className={`flex items-center gap-1.5 border rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
              ${onlyFavs
                ? 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:border-amber-600 dark:text-amber-300'
                : 'border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
            <Star size={14} className={onlyFavs ? 'fill-amber-400 text-amber-400' : ''} />
            Favoritos
          </button>

          <button
            onClick={() => setOnlyMine((v) => !v)}
            className={`flex items-center gap-1.5 border rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
              ${onlyMine
                ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-600 dark:text-indigo-300'
                : 'border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
            <User size={14} />
            Mis Proyectos
          </button>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-slate-400 hover:text-slate-600 text-sm px-2 transition-colors">
              <X size={13} /> Limpiar
            </button>
          )}
        </div>

        {/* ── Expandable filter panel ──────────────────────────── */}
        {showFilters && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700
            rounded-xl p-4 flex flex-wrap gap-4">
            <div className="flex-1 min-w-36">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                Estado
              </label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2
                  text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500
                  bg-white dark:bg-slate-700 dark:text-slate-100">
                <option value="">Todos</option>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-36">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                Categoría
              </label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2
                  text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500
                  bg-white dark:bg-slate-700 dark:text-slate-100">
                <option value="">Todas</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-36">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                Prioridad
              </label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2
                  text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500
                  bg-white dark:bg-slate-700 dark:text-slate-100">
                <option value="">Todas</option>
                {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* ── Active filter chips ──────────────────────────────── */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-2">
            {status && (
              <span className="flex items-center gap-1 text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-full font-medium">
                {STATUS_LABELS[status]}
                <button onClick={() => setStatus('')}><X size={10} /></button>
              </span>
            )}
            {category && (
              <span className="flex items-center gap-1 text-xs bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-full font-medium">
                {categories.find((c) => String(c.id) === String(category))?.name ?? 'Categoría'}
                <button onClick={() => setCategory('')}><X size={10} /></button>
              </span>
            )}
            {priority && (
              <span className="flex items-center gap-1 text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-full font-medium">
                {PRIORITY_LABELS[priority]}
                <button onClick={() => setPriority('')}><X size={10} /></button>
              </span>
            )}
            {onlyFavs && (
              <span className="flex items-center gap-1 text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-full font-medium">
                Favoritos
                <button onClick={() => setOnlyFavs(false)}><X size={10} /></button>
              </span>
            )}
            {onlyMine && (
              <span className="flex items-center gap-1 text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-full font-medium">
                Mis proyectos
                <button onClick={() => setOnlyMine(false)}><X size={10} /></button>
              </span>
            )}
          </div>
        )}

        {/* ── Content ─────────────────────────────────────────── */}
        {loading ? (
          /* Skeleton grid */
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border-l-4 border-l-slate-200 dark:border-l-slate-600 p-5 animate-pulse">
                <div className="flex justify-between mb-3">
                  <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-3 w-10 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
                <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded-full mb-2" />
                <div className="h-5 w-3/4 bg-slate-200 dark:bg-slate-700 rounded mb-1" />
                <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-700 rounded mb-4" />
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full mb-4" />
                <div className="flex justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
                  <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-4 w-14 bg-slate-200 dark:bg-slate-700 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : visibleProjects.length === 0 ? (
          /* Empty state */
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FolderKanban size={30} className="text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-slate-700 dark:text-slate-200 font-semibold text-lg mb-1">
              {hasFilters ? 'Sin resultados' : 'No hay proyectos aún'}
            </p>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
              {hasFilters
                ? 'Ningún proyecto coincide con los filtros seleccionados.'
                : 'Crea el primer proyecto para empezar.'}
            </p>
            {hasFilters ? (
              <button
                onClick={clearFilters}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                Limpiar filtros
              </button>
            ) : (
              canCreate && (
                <Link
                  to="/projects/new"
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700
                    text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                  <Plus size={14} /> Crear proyecto
                </Link>
              )
            )}
          </div>
        ) : (
          /* Project grid */
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {visibleProjects.map((p) => (
              <ProjectCard
                key={p.id}
                p={p}
                isFavorite={favorites.has(Number(p.id))}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        )}

      </div>
    </Layout>

    {showImport && (
      <ProjectImportModal
        onClose={() => setShowImport(false)}
        onImported={() => { load(); setShowImport(false); }}
      />
    )}
    </>
  );
}
