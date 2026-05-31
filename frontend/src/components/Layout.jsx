import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { projectsAPI } from '../services/projectsAPI';
import { useActiveTimer, formatElapsed } from '../hooks/useTimer';
import { toast } from 'sonner';
import {
  LayoutDashboard, FolderKanban, Tag, User, LogOut,
  Menu, X, ChevronRight, BarChart2, Building2, Shield, Lock,
  Bell, AlertTriangle, Clock, Flag, Search, CheckSquare,
  Sun, Moon, ListTodo, CalendarDays, Square, LayoutTemplate, ScrollText, Briefcase,
  Target, KeyRound,
} from 'lucide-react';

const SEVERITY_ICON = {
  error:   { icon: AlertTriangle, cls: 'text-red-500' },
  warning: { icon: Clock,         cls: 'text-amber-500' },
  info:    { icon: Flag,          cls: 'text-blue-500' },
};

function navSection(label, items) {
  return { label, items };
}

export default function Layout({ children }) {
  const { user, logout }        = useAuthStore();
  const { isDark, toggleTheme } = useThemeStore();
  const location                = useLocation();
  const navigate                = useNavigate();
  const activeTimer             = useActiveTimer();

  // Live elapsed for the floating chip
  const [timerElapsed, setTimerElapsed] = useState(0);
  useEffect(() => {
    if (!activeTimer) { setTimerElapsed(0); return; }
    const tick = () => setTimerElapsed(Math.floor((Date.now() - activeTimer.startedAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeTimer]);

  const [sidebarOpen, setSidebarOpen]     = useState(true);
  const [mobileOpen, setMobileOpen]       = useState(false);
  const [notifOpen, setNotifOpen]         = useState(false);
  const [notifTab, setNotifTab]           = useState('user'); // 'user' | 'alerts'
  const [notifications, setNotifications] = useState([]);
  const [notifCount, setNotifCount]       = useState(0);
  const [bellRinging, setBellRinging]     = useState(false);
  const [userNotifs, setUserNotifs]       = useState([]);
  const [userUnread, setUserUnread]       = useState(0);
  const [loadingUserNotifs, setLoadingUserNotifs] = useState(false);
  const notifRef        = useRef(null);
  const prevAlertKeys   = useRef(null);
  const prevUserUnread  = useRef(0);

  // Dismissed alert keys (sessionStorage — resets on tab close)
  const [dismissedKeys, setDismissedKeys] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('notif_dismissed') || '[]'); } catch { return []; }
  });
  const getAlertKey = (n) => `${n.type}:${n.body}`;
  const unreadCount = userUnread + notifications.filter((n) => !dismissedKeys.includes(getAlertKey(n))).length;

  const [searchQ, setSearchQ]               = useState('');
  const [searchResults, setSearchResults]   = useState(null);
  const [searchOpen, setSearchOpen]         = useState(false);
  const [searching, setSearching]           = useState(false);
  const [searchSelectedIdx, setSearchSelectedIdx] = useState(-1);
  const searchRef      = useRef(null);
  const searchInputRef = useRef(null);

  // Flat ordered list for keyboard navigation
  const SEARCH_CATS = ['projects', 'tasks', 'milestones', 'users', 'docs'];
  const flatResults = searchResults
    ? SEARCH_CATS.flatMap((cat) =>
        (searchResults[cat] || []).map((item) => ({ cat, item }))
      )
    : [];

  const isMac  = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  const isAdmin      = user?.role === 'ADMIN';
  const isTeamMember = user?.role === 'TEAM_MEMBER';

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // ── Notification polling ────────────────────────────────────────────────────
  const loadNotifications = useCallback(() => {
    projectsAPI.getNotifications()
      .then((r) => {
        const newAlerts  = r.data.alerts || [];
        const newUnread  = r.data.unread_user || 0;

        // Detectar alertas del sistema nuevas
        if (prevAlertKeys.current !== null) {
          const incoming = newAlerts.filter((n) => !prevAlertKeys.current.has(getAlertKey(n)));
          if (incoming.length > 0) {
            setBellRinging(true);
            setTimeout(() => setBellRinging(false), 1800);
            incoming.slice(0, 3).forEach((n) => {
              const toastFn = n.severity === 'error' ? toast.error : toast.warning;
              toastFn(n.title, { description: n.body, duration: 6000 });
            });
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              incoming.slice(0, 2).forEach((n) => {
                try { new Notification(n.title, { body: n.body, icon: '/favicon.ico' }); } catch { /* */ }
              });
            }
          }
        }

        // Detectar notificaciones de usuario nuevas
        if (newUnread > prevUserUnread.current && prevUserUnread.current !== null) {
          const diff = newUnread - prevUserUnread.current;
          if (diff > 0 && prevUserUnread.current > 0) {
            setBellRinging(true);
            setTimeout(() => setBellRinging(false), 1800);
            toast.info(`${diff} nueva${diff !== 1 ? 's' : ''} notificación${diff !== 1 ? 'es' : ''}`, { duration: 4000 });
          }
          // Recargar lista de notificaciones de usuario si el panel está abierto
          if (notifOpen) loadUserNotifs();
        }

        prevAlertKeys.current = new Set(newAlerts.map(getAlertKey));
        prevUserUnread.current = newUnread;
        setNotifications(newAlerts);
        setNotifCount(r.data.count || 0);
        setUserUnread(newUnread);
      })
      .catch(() => {});
  }, [notifOpen]);

  const loadUserNotifs = useCallback(() => {
    setLoadingUserNotifs(true);
    projectsAPI.getUserNotifications()
      .then(r => { setUserNotifs(r.data.data ?? []); setUserUnread(r.data.unread ?? 0); })
      .catch(() => {})
      .finally(() => setLoadingUserNotifs(false));
  }, []);

  const markRead = async (id) => {
    await projectsAPI.markNotificationRead(id).catch(() => {});
    setUserNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: '1' } : n));
    setUserUnread(prev => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    await projectsAPI.markAllNotificationsRead().catch(() => {});
    setUserNotifs(prev => prev.map(n => ({ ...n, is_read: '1' })));
    setUserUnread(0);
  };

  const deleteNotif = async (id) => {
    await projectsAPI.deleteNotification(id).catch(() => {});
    setUserNotifs(prev => prev.filter(n => n.id !== id));
  };

  // Initial load + poll every 30 s
  useEffect(() => {
    loadNotifications();
    const id = setInterval(loadNotifications, 30_000);
    return () => clearInterval(id);
  }, [loadNotifications]);

  // Outside click + Ctrl/Cmd+K
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
    };
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      if (e.key === 'Escape') { setSearchOpen(false); searchInputRef.current?.blur(); }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchQ.length < 2) { setSearchResults(null); setSearchOpen(false); setSearchSelectedIdx(-1); return; }
    const t = setTimeout(() => {
      setSearching(true);
      projectsAPI.search(searchQ)
        .then((r) => { setSearchResults(r.data); setSearchOpen(true); setSearchSelectedIdx(-1); })
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ]);

  const handleSearchSelect = (path) => {
    setSearchQ(''); setSearchOpen(false); setSearchResults(null); setSearchSelectedIdx(-1);
    navigate(path);
  };

  const getResultPath = ({ cat, item }) => {
    if (cat === 'projects') return `/projects/${item.id}`;
    if (cat === 'users')    return `/users`;
    if (cat === 'docs')     return `/projects/${item.project_id}?tab=technicaldocs`;
    return `/projects/${item.project_id}`;
  };

  const handleSearchKeyDown = (e) => {
    if (!searchOpen || flatResults.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSearchSelectedIdx((i) => (i + 1) % flatResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSearchSelectedIdx((i) => (i <= 0 ? flatResults.length - 1 : i - 1));
    } else if (e.key === 'Enter' && searchSelectedIdx >= 0) {
      e.preventDefault();
      handleSearchSelect(getResultPath(flatResults[searchSelectedIdx]));
    }
  };

  const handleLogout = () => { logout(); navigate('/'); };

  const sections = [
    navSection('Principal', [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard'   },
      { to: '/portfolio', icon: Briefcase,        label: 'Portfolio'   },
      { to: '/projects',  icon: FolderKanban,    label: 'Proyectos'   },
      { to: '/my-tasks',  icon: ListTodo,         label: 'Mis Tareas'  },
      { to: '/calendar',  icon: CalendarDays,     label: 'Calendario'  },
      { to: '/reports',   icon: BarChart2,        label: 'Reportes'   },
    ]),
    navSection('Catálogos', [
      { to: '/categories', icon: Tag,            label: 'Categorías' },
      { to: '/templates',  icon: LayoutTemplate, label: 'Plantillas' },
      { to: '/okrs',       icon: Target,         label: 'OKRs'       },
    ]),
    ...(isAdmin ? [navSection('Administración', [
      { to: '/users',            icon: Shield,     label: 'Usuarios'   },
      { to: '/permissions',      icon: Lock,       label: 'Permisos'   },
      { to: '/roles',            icon: KeyRound,   label: 'Roles'      },
      { to: '/company-settings', icon: Building2,  label: 'Empresa'    },
      { to: '/audit',            icon: ScrollText, label: 'Auditoría'  },
    ])] : isTeamMember ? [] : [navSection('Configuración', [
      { to: '/company-settings', icon: Building2, label: 'Empresa' },
    ])]),
    navSection('Cuenta', [
      { to: '/profile', icon: User, label: 'Mi Perfil' },
    ]),
  ];

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-950 overflow-hidden">

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className={[
        'bg-slate-900 text-white flex flex-col flex-shrink-0',
        'fixed inset-y-0 left-0 z-50 w-64',
        'transform transition-all duration-300 ease-in-out',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:static lg:inset-auto lg:z-auto lg:translate-x-0',
        sidebarOpen ? 'lg:w-64' : 'lg:w-16',
      ].join(' ')}>

        {/* Logo + toggle */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-700 h-12">
          {sidebarOpen && (
            <img
              src="/assets/img/logos/maewalliscorpv3.jpg"
              alt="MaeWallisCorp"
              className="h-8 object-contain rounded"
            />
          )}
          {/* Desktop toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-400 hover:text-white p-1 rounded hidden lg:flex items-center"
            title="Ocultar sidebar"
          >
            {sidebarOpen ? <X size={17} /> : <Menu size={17} />}
          </button>
          {/* Mobile close */}
          <button
            onClick={() => setMobileOpen(false)}
            className="text-slate-400 hover:text-white p-1 rounded lg:hidden ml-auto"
          >
            <X size={17} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          {sections.map(({ label, items }) => (
            <div key={label} className="mb-1">
              {sidebarOpen && (
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 pt-3 pb-1">
                  {label}
                </p>
              )}
              {items.map(({ to, icon: Icon, label: itemLabel }) => {
                const active = location.pathname === to ||
                  (to !== '/dashboard' && location.pathname.startsWith(to));
                return (
                  <Link key={to} to={to}
                    title={!sidebarOpen ? itemLabel : undefined}
                    className={[
                      'flex items-center gap-3 py-2.5 transition-colors mx-1 rounded-lg',
                      sidebarOpen ? 'px-4' : 'px-0 justify-center',
                      active
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white',
                    ].join(' ')}>
                    <Icon size={18} className="flex-shrink-0" />
                    {sidebarOpen && (
                      <>
                        <span className="text-sm font-medium flex-1">{itemLabel}</span>
                        {active && <ChevronRight size={14} />}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-slate-700 p-3">
          {sidebarOpen ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-sm font-bold flex-shrink-0">
                {(user?.first_name?.[0] || user?.username?.[0] || '?').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.first_name || user?.username}</p>
                <p className="text-xs text-slate-400 truncate">{user?.role?.replace('_', ' ')}</p>
              </div>
              <button onClick={handleLogout} className="text-slate-400 hover:text-red-400 p-1" title="Cerrar sesión">
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <button onClick={handleLogout} className="text-slate-400 hover:text-red-400 w-full flex justify-center py-1" title="Cerrar sesión">
              <LogOut size={18} />
            </button>
          )}
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top bar */}
        <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 h-12 flex items-center gap-3 px-3 sm:px-4 flex-shrink-0">

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white p-1 rounded lg:hidden flex-shrink-0"
          >
            <Menu size={20} />
          </button>

          {/* Global search */}
          <div className="relative flex-1 max-w-md" ref={searchRef}>
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onFocus={() => searchResults && setSearchOpen(true)}
              onKeyDown={handleSearchKeyDown}
              placeholder={`Buscar… ${isMac ? '⌘K' : 'Ctrl+K'}`}
              className="w-full pl-9 pr-4 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
            />
            {searching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">…</span>
            )}
            {searchOpen && searchResults && (
              <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
                {(() => {
                  const CAT_META = {
                    projects:   { label: 'Proyectos',  icon: <FolderKanban  size={14} className="text-indigo-500 flex-shrink-0" /> },
                    tasks:      { label: 'Tareas',     icon: <CheckSquare   size={14} className="text-emerald-500 flex-shrink-0" /> },
                    milestones: { label: 'Hitos',      icon: <Flag          size={14} className="text-purple-500 flex-shrink-0" /> },
                    users:      { label: 'Usuarios',   icon: <User          size={14} className="text-rose-400 flex-shrink-0" /> },
                    docs:       { label: 'Documentos', icon: <LayoutTemplate size={14} className="text-amber-500 flex-shrink-0" /> },
                  };
                  let globalIdx = 0;
                  const sections = SEARCH_CATS.map((cat) => {
                    const items = searchResults[cat] || [];
                    if (!items.length) return null;
                    const { label, icon } = CAT_META[cat] ?? { label: cat, icon: null };
                    return (
                      <div key={cat}>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 pt-3 pb-1">{label}</p>
                        {items.map((item) => {
                          const idx = globalIdx++;
                          const isSelected = idx === searchSelectedIdx;
                          const path = cat === 'projects' ? `/projects/${item.id}`
                                     : cat === 'users'    ? `/users`
                                     : cat === 'docs'     ? `/projects/${item.project_id}?tab=technicaldocs`
                                     : `/projects/${item.project_id}`;
                          const subtitle = cat === 'users'
                            ? (item.position || item.role?.replace('_', ' '))
                            : cat === 'docs'
                            ? item.project_name
                            : (item.project_name || item.project_code || null);
                          return (
                            <button key={item.id} onClick={() => handleSearchSelect(path)}
                              className={[
                                'w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors',
                                isSelected
                                  ? 'bg-indigo-50 dark:bg-indigo-900/40'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-700',
                              ].join(' ')}>
                              {icon}
                              <div className="min-w-0">
                                <p className="text-sm text-slate-700 dark:text-slate-200 truncate font-medium">
                                  {cat === 'users'
                                    ? `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.username
                                    : (item.name || item.title)}
                                </p>
                                {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
                              </div>
                              {isSelected && <ChevronRight size={12} className="ml-auto text-indigo-400 flex-shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    );
                  });
                  if (flatResults.length === 0) {
                    return <p className="text-sm text-slate-400 text-center py-6">Sin resultados para "{searchQ}"</p>;
                  }
                  return sections;
                })()}
                <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-2 flex items-center gap-3">
                  <span className="text-xs text-slate-400">↑↓ navegar</span>
                  <span className="text-xs text-slate-400">↵ abrir</span>
                  <span className="text-xs text-slate-400">Esc cerrar</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-2 ml-auto flex-shrink-0">

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title={isDark ? 'Tema claro' : 'Tema oscuro'}
            >
              {isDark ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button onClick={() => {
                  const opening = !notifOpen;
                  setNotifOpen(opening);
                  setBellRinging(false);
                  if (opening) {
                    loadUserNotifs();
                    // Mark system alerts as seen
                    if (notifications.length > 0) {
                      const keys = notifications.map(getAlertKey);
                      setDismissedKeys(keys);
                      try { sessionStorage.setItem('notif_dismissed', JSON.stringify(keys)); } catch { /* */ }
                    }
                  }
                }}
                className={[
                  'relative p-2 rounded-lg transition-all',
                  bellRinging
                    ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 animate-bounce'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700',
                ].join(' ')}>
                <Bell size={17} />
                {unreadCount > 0 && (
                  <span className={[
                    'absolute top-1 right-1 w-4 h-4 text-white text-xs rounded-full flex items-center justify-center font-bold leading-none',
                    bellRinging ? 'bg-amber-500 animate-ping' : 'bg-red-500',
                  ].join(' ')}>
                    {bellRinging ? '' : (unreadCount > 9 ? '9+' : unreadCount)}
                  </span>
                )}
                {unreadCount > 0 && bellRinging && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center font-bold leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-full mt-1 w-96 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">

                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <Bell size={14} className="text-indigo-500" /> Notificaciones
                    </span>
                    <div className="flex items-center gap-1.5">
                      {userUnread > 0 && (
                        <button onClick={markAllRead}
                          className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                          Marcar todas leídas
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); loadNotifications(); loadUserNotifs(); }}
                        title="Actualizar" className="p-1 text-slate-400 hover:text-indigo-500 transition-colors rounded">
                        <RefreshCw size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex border-b border-slate-100 dark:border-slate-700">
                    {[
                      { id: 'user',   label: 'Mis notificaciones', count: userUnread },
                      { id: 'alerts', label: 'Alertas del sistema', count: notifCount },
                    ].map(t => (
                      <button key={t.id} onClick={() => setNotifTab(t.id)}
                        className={`flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1.5
                          ${notifTab === t.id ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                        {t.label}
                        {t.count > 0 && (
                          <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                            {t.count > 9 ? '9+' : t.count}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Panel — User notifications */}
                  {notifTab === 'user' && (
                    <div className="max-h-80 overflow-y-auto">
                      {loadingUserNotifs ? (
                        <div className="text-center py-8 text-slate-400 text-xs">Cargando…</div>
                      ) : userNotifs.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 text-sm">
                          <Bell size={24} className="mx-auto mb-2 opacity-20" />
                          Sin notificaciones
                        </div>
                      ) : userNotifs.map((n) => {
                        const isUnread = !parseInt(n.is_read);
                        const typeIcon = {
                          task_assigned:       { emoji: '👤', color: 'text-indigo-500' },
                          task_status_changed: { emoji: '🔄', color: 'text-blue-500'   },
                          task_comment:        { emoji: '💬', color: 'text-emerald-500' },
                          mention:             { emoji: '@',  color: 'text-violet-600'  },
                          announcement:        { emoji: '📢', color: 'text-amber-500'   },
                        }[n.type] ?? { emoji: '🔔', color: 'text-slate-400' };

                        return (
                          <div key={n.id}
                            className={`flex items-start gap-3 px-4 py-3 border-b border-slate-50 dark:border-slate-700 last:border-0 transition-colors group
                              ${isUnread ? 'bg-indigo-50/40 dark:bg-indigo-900/10 hover:bg-indigo-50 dark:hover:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                            {/* Icon */}
                            <span className="text-base flex-shrink-0 mt-0.5 w-6 text-center">{typeIcon.emoji}</span>

                            {/* Content — click to navigate + mark read */}
                            <Link to={n.link || '#'}
                              onClick={() => { markRead(n.id); setNotifOpen(false); }}
                              className="flex-1 min-w-0 block">
                              <p className={`text-xs font-semibold leading-snug ${isUnread ? 'text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'}`}>
                                {n.title}
                                {isUnread && <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 ml-1.5 mb-0.5" />}
                              </p>
                              {n.body && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>}
                              <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-0.5">
                                {(() => {
                                  const diff = Date.now() - new Date(n.created_at).getTime();
                                  const m = Math.floor(diff/60000), h = Math.floor(m/60), d = Math.floor(h/24);
                                  return m < 1 ? 'ahora mismo' : m < 60 ? `hace ${m}m` : h < 24 ? `hace ${h}h` : `hace ${d}d`;
                                })()}
                              </p>
                            </Link>

                            {/* Actions */}
                            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              {isUnread && (
                                <button onClick={() => markRead(n.id)} title="Marcar leída"
                                  className="p-1 text-slate-300 hover:text-indigo-500 transition-colors">
                                  <CheckSquare size={12} />
                                </button>
                              )}
                              <button onClick={() => deleteNotif(n.id)} title="Eliminar"
                                className="p-1 text-slate-300 hover:text-red-500 transition-colors">
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Panel — System alerts */}
                  {notifTab === 'alerts' && (
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 text-sm">
                          <CheckSquare size={24} className="mx-auto mb-2 opacity-20" />
                          Sin alertas pendientes
                        </div>
                      ) : notifications.map((n, i) => {
                        const { icon: NIcon, cls } = SEVERITY_ICON[n.severity] || SEVERITY_ICON.info;
                        const isNew = !dismissedKeys.includes(getAlertKey(n));
                        return (
                          <Link key={i} to={n.link || '#'}
                            onClick={() => setNotifOpen(false)}
                            className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-b border-slate-50 dark:border-slate-700 last:border-0 ${isNew ? 'bg-red-50/40 dark:bg-red-900/10' : ''}`}>
                            <NIcon size={15} className={`${cls} mt-0.5 flex-shrink-0`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                {n.title}
                                {isNew && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{n.body}</p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    {typeof Notification !== 'undefined' && Notification.permission === 'default' ? (
                      <button onClick={() => Notification.requestPermission()}
                        className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                        <Bell size={10} /> Activar notif. nativas
                      </button>
                    ) : <span />}
                    <p className="text-[10px] text-slate-300 dark:text-slate-600">Actualiza cada 30s</p>
                  </div>
                </div>
              )}
            </div>

            {/* User chip */}
            <Link to="/profile"
              className="flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg px-2 py-1 transition-colors">
              <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                {(user?.first_name?.[0] || user?.username?.[0] || '?').toUpperCase()}
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200 hidden sm:block">
                {user?.first_name || user?.username}
              </span>
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-950 relative">
          {children}

          {/* ── Floating active-timer chip ─────────────────────────── */}
          {activeTimer && (
            <div className="fixed bottom-5 right-5 z-40 flex items-center gap-3
                            bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700
                            shadow-lg rounded-2xl px-4 py-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-mono text-base font-bold text-emerald-700 dark:text-emerald-400 tabular-nums leading-none">
                  {formatElapsed(timerElapsed)}
                </p>
                {activeTimer.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-[160px] truncate">
                    {activeTimer.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  // Stop timer without saving — user goes to the task to save properly
                  localStorage.removeItem('active_timer');
                  window.dispatchEvent(new Event('storage'));
                }}
                title="Cancelar timer"
                className="text-slate-400 hover:text-red-500 transition-colors p-1 flex-shrink-0">
                <Square size={14} />
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
