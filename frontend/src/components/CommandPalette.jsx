/**
 * CommandPalette — Global ⌘K / Ctrl+K search overlay.
 *
 * Shows quick-nav links when idle, live search results (projects, tasks,
 * milestones, users, docs) while typing, with full keyboard navigation.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, FolderKanban, CheckSquare, Flag, User, LayoutTemplate,
  LayoutDashboard, Briefcase, ListTodo, CalendarDays, BarChart2,
  ArrowRight, Loader2, Target,
} from 'lucide-react';
import { projectsAPI } from '../services/projectsAPI';

// ── Quick-nav shortcuts shown when query is empty ─────────────────────────────
const QUICK_LINKS = [
  { label: 'Dashboard',  icon: LayoutDashboard, path: '/dashboard'  },
  { label: 'Proyectos',  icon: FolderKanban,    path: '/projects'   },
  { label: 'Mis Tareas', icon: ListTodo,        path: '/my-tasks'   },
  { label: 'Portfolio',  icon: Briefcase,       path: '/portfolio'  },
  { label: 'Calendario', icon: CalendarDays,    path: '/calendar'   },
  { label: 'Reportes',   icon: BarChart2,       path: '/reports'    },
  { label: 'OKRs',       icon: Target,          path: '/okrs'       },
];

const CAT_META = {
  projects:   { label: 'Proyectos',  Icon: FolderKanban,   cls: 'text-indigo-500' },
  tasks:      { label: 'Tareas',     Icon: CheckSquare,    cls: 'text-emerald-500' },
  milestones: { label: 'Hitos',      Icon: Flag,           cls: 'text-purple-500' },
  users:      { label: 'Usuarios',   Icon: User,           cls: 'text-rose-400' },
  docs:       { label: 'Documentos', Icon: LayoutTemplate, cls: 'text-amber-500' },
};
const CATS = ['projects', 'tasks', 'milestones', 'users', 'docs'];

function getPath(cat, item) {
  if (cat === 'projects') return `/projects/${item.id}`;
  if (cat === 'users')    return `/users`;
  if (cat === 'docs')     return `/projects/${item.project_id}?tab=technicaldocs`;
  return `/projects/${item.project_id}`;
}

function getLabel(cat, item) {
  if (cat === 'users') return `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.username;
  return item.name || item.title || '';
}

function getSub(cat, item) {
  if (cat === 'users') return item.position || item.role?.replace('_', ' ') || '';
  return item.project_name || item.project_code || '';
}

// ─────────────────────────────────────────────────────────────────────────────

export default function CommandPalette({ open, onClose }) {
  const navigate                       = useNavigate();
  const inputRef                       = useRef(null);
  const listRef                        = useRef(null);
  const [query, setQuery]              = useState('');
  const [results, setResults]          = useState(null);
  const [loading, setLoading]          = useState(false);
  const [activeIdx, setActiveIdx]      = useState(0);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults(null);
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) { setResults(null); setActiveIdx(0); return; }
    const t = setTimeout(() => {
      setLoading(true);
      projectsAPI.search(query)
        .then((r) => { setResults(r.data); setActiveIdx(0); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  // Flat list for keyboard nav
  const flatItems = query.length < 2
    ? QUICK_LINKS.map((ql) => ({ type: 'quick', ...ql }))
    : results
      ? CATS.flatMap((cat) =>
          (results[cat] || []).map((item) => ({ type: 'result', cat, item }))
        )
      : [];

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const go = useCallback((path) => {
    onClose();
    navigate(path);
  }, [navigate, onClose]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape')     { e.preventDefault(); onClose(); return; }
    if (e.key === 'ArrowDown')  { e.preventDefault(); setActiveIdx((i) => (i + 1) % Math.max(flatItems.length, 1)); return; }
    if (e.key === 'ArrowUp')    { e.preventDefault(); setActiveIdx((i) => (i <= 0 ? flatItems.length - 1 : i - 1)); return; }
    if (e.key === 'Enter' && flatItems[activeIdx]) {
      e.preventDefault();
      const it = flatItems[activeIdx];
      go(it.type === 'quick' ? it.path : getPath(it.cat, it.item));
    }
  };

  if (!open) return null;

  const showQuick   = query.length < 2;
  const showResults = !showQuick && results;
  const noResults   = !showQuick && results && flatItems.length === 0;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[12vh] px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Blur overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Panel */}
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[70vh]">

        {/* Search input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
          {loading
            ? <Loader2 size={18} className="text-slate-400 animate-spin flex-shrink-0" />
            : <Search size={18} className="text-slate-400 flex-shrink-0" />
          }
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Buscar proyectos, tareas, usuarios…"
            className="flex-1 bg-transparent outline-none text-base text-slate-800 dark:text-slate-100 placeholder-slate-400"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono border border-slate-200 dark:border-slate-600 rounded text-slate-400">
            Esc
          </kbd>
        </div>

        {/* Results list */}
        <div ref={listRef} className="overflow-y-auto flex-1">

          {/* ── Quick links ─── */}
          {showQuick && (
            <div className="py-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 px-4 pb-1 pt-2">
                Navegación rápida
              </p>
              {QUICK_LINKS.map((ql, i) => {
                const Icon = ql.icon;
                const isActive = i === activeIdx;
                return (
                  <button
                    key={ql.path}
                    data-active={isActive}
                    onClick={() => go(ql.path)}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={[
                      'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60',
                    ].join(' ')}
                  >
                    <Icon size={15} className={isActive ? 'text-indigo-500' : 'text-slate-400'} />
                    <span className="flex-1 text-left font-medium">{ql.label}</span>
                    {isActive && <ArrowRight size={13} className="text-indigo-400" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Search results ─── */}
          {showResults && (() => {
            let globalIdx = 0;
            return CATS.map((cat) => {
              const items = results[cat] || [];
              if (!items.length) return null;
              const { label, Icon, cls } = CAT_META[cat];
              return (
                <div key={cat}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 px-4 pb-1 pt-3">
                    {label}
                  </p>
                  {items.map((item) => {
                    const idx = globalIdx++;
                    const isActive = idx === activeIdx;
                    const path = getPath(cat, item);
                    return (
                      <button
                        key={item.id}
                        data-active={isActive}
                        onClick={() => go(path)}
                        onMouseEnter={() => setActiveIdx(idx)}
                        className={[
                          'w-full flex items-center gap-3 px-4 py-2.5 transition-colors',
                          isActive
                            ? 'bg-indigo-50 dark:bg-indigo-900/40'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-700/60',
                        ].join(' ')}
                      >
                        <Icon size={15} className={`${cls} flex-shrink-0`} />
                        <div className="min-w-0 flex-1 text-left">
                          <p className="text-sm text-slate-800 dark:text-slate-100 font-medium truncate">
                            {getLabel(cat, item)}
                          </p>
                          {getSub(cat, item) && (
                            <p className="text-xs text-slate-400 truncate">{getSub(cat, item)}</p>
                          )}
                        </div>
                        {isActive && <ArrowRight size={13} className="text-indigo-400 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              );
            });
          })()}

          {/* ── No results ─── */}
          {noResults && (
            <p className="text-sm text-slate-400 text-center py-10">
              Sin resultados para <span className="font-medium text-slate-600 dark:text-slate-300">"{query}"</span>
            </p>
          )}

          {/* ── Loading state ─── */}
          {!showQuick && !results && loading && (
            <p className="text-sm text-slate-400 text-center py-10">Buscando…</p>
          )}
        </div>

        {/* Footer hints */}
        <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-2 flex items-center gap-4">
          <span className="text-[11px] text-slate-400">↑↓ navegar</span>
          <span className="text-[11px] text-slate-400">↵ abrir</span>
          <span className="text-[11px] text-slate-400">Esc cerrar</span>
        </div>
      </div>
    </div>
  );
}
