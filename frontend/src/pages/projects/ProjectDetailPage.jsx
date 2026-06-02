import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { projectsAPI } from '../../services/projectsAPI';
import Layout from '../../components/Layout';
import { toast } from 'sonner';
import ConfirmModal from '../../components/ConfirmModal';
import { useAuthStore } from '../../stores/authStore';
import {
  ArrowLeft, Edit, Trash2, Users, AlertTriangle,
  Zap, ListChecks, FileText, BarChart2, Flag,
  CheckCircle2, Clock, TrendingUp, Calendar, Activity, Layers,
  ScrollText, BookOpen, Milestone, ShieldAlert, CheckSquare, Clapperboard, ClipboardList,
  Tag, ChevronRight, User, Sparkles, MessageSquare, BookOpen as WikiIcon,
  Target, Webhook, Link2, Upload, TrendingDown, GitFork,
} from 'lucide-react';
import SprintList from '../../components/projects/SprintList';
import BacklogList from '../../components/projects/BacklogList';
import KanbanBoard from '../../components/projects/KanbanBoard';
import RiskList from '../../components/projects/RiskList';
import IncidentList from '../../components/projects/IncidentList';
import MemberList from '../../components/projects/MemberList';
import DocumentList from '../../components/projects/DocumentList';
import MilestoneList from '../../components/projects/MilestoneList';
import SprintPlanningView from '../../components/projects/SprintPlanningView';
import GanttView from '../../components/projects/GanttView';
import WorkloadView from '../../components/projects/WorkloadView';
import ActivityFeed from '../../components/projects/ActivityFeed';
import ContractList from '../../components/projects/ContractList';
import TechnicalDocList from '../../components/projects/TechnicalDocList';
import EpicsList from '../../components/projects/EpicsList';
import ImpedimentLog from '../../components/projects/ImpedimentLog';
import DefinitionOfDone from '../../components/projects/DefinitionOfDone';
import SprintCeremonies from '../../components/projects/SprintCeremonies';
import SprintMetrics from '../../components/projects/SprintMetrics';
import MeetingMinutes from '../../components/projects/MeetingMinutes';
import AIProjectSummary from '../../components/projects/AIProjectSummary';
import BurnupChart from '../../components/projects/BurnupChart';
import EVMWidget from '../../components/projects/EVMWidget';
import DeliveryPrediction from '../../components/projects/DeliveryPrediction';
import ProjectChatView from '../../components/projects/ProjectChatView';
import WikiView from '../../components/projects/WikiView';
import OKRsView from '../../components/projects/OKRsView';
import CapacityView from '../../components/projects/CapacityView';
import WebhookManager from '../../components/projects/WebhookManager';
import GuestInviteManager from '../../components/projects/GuestInviteManager';
import CSVImportModal from '../../components/projects/CSVImportModal';
import AutomationsView from '../../components/projects/AutomationsView';
import ReleasesView from '../../components/projects/ReleasesView';
import StandupView from '../../components/projects/StandupView';
import WeeklyReportsView from '../../components/projects/WeeklyReportsView';
import SLAView from '../../components/projects/SLAView';
import AnnouncementsView from '../../components/projects/AnnouncementsView';
import GitIntegrationView from '../../components/projects/GitIntegrationView';
import CustomFieldsView from '../../components/projects/CustomFieldsView';
import ProjectStatusesView from '../../components/projects/ProjectStatusesView';
import HillChart from '../../components/projects/HillChart';
import WhatIfView from '../../components/projects/WhatIfView';
import TaskListView from '../../components/projects/TaskListView';
import DependencyGraph from '../../components/projects/DependencyGraph';

// ─── Static data ──────────────────────────────────────────────────────────────

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
const STATUSES = Object.keys(STATUS_COLORS);

/** Left-border accent + SVG ring colour keyed by project status */
const STATUS_ACCENT = {
  INICIACION:    { border: 'border-l-indigo-500',  ring: '#6366f1' },
  PLANIFICACION: { border: 'border-l-purple-500',  ring: '#a855f7' },
  EJECUCION:     { border: 'border-l-blue-500',    ring: '#3b82f6' },
  MONITOREO:     { border: 'border-l-amber-500',   ring: '#f59e0b' },
  CIERRE:        { border: 'border-l-emerald-500', ring: '#10b981' },
  PAUSADO:       { border: 'border-l-slate-400',   ring: '#94a3b8' },
  CANCELADO:     { border: 'border-l-red-500',     ring: '#ef4444' },
};

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-purple-500', 'bg-blue-500', 'bg-emerald-500',
  'bg-amber-500',  'bg-rose-500',   'bg-teal-500', 'bg-cyan-500',
];

/** All tabs in logical display order, annotated with group key */
const ALL_TABS = [
  { id: 'overview',      label: 'Resumen',      icon: BarChart2,     managerOnly: false, group: 'overview'   },
  { id: 'epics',         label: 'Épicas',        icon: Milestone,     managerOnly: false, group: 'scrum'      },
  { id: 'sprints',       label: 'Sprints',       icon: Zap,           managerOnly: false, group: 'scrum'      },
  { id: 'backlog',       label: 'Backlog',       icon: ListChecks,    managerOnly: false, group: 'scrum'      },
  { id: 'planning',      label: 'Planificación', icon: Layers,        managerOnly: true,  group: 'scrum'      },
  { id: 'kanban',        label: 'Kanban',        icon: ListChecks,    managerOnly: false, group: 'scrum'      },
  { id: 'lista',         label: 'Lista',         icon: ScrollText,    managerOnly: false, group: 'scrum'      },
  { id: 'metrics',       label: 'Métricas',      icon: TrendingUp,    managerOnly: false, group: 'control'    },
  { id: 'milestones',    label: 'Hitos',         icon: Flag,          managerOnly: false, group: 'control'    },
  { id: 'timeline',      label: 'Tiempo',        icon: Calendar,      managerOnly: true,  group: 'control'    },
  { id: 'depgraph',      label: 'Dependencias',  icon: GitFork,       managerOnly: false, group: 'control'    },
  { id: 'risks',         label: 'Riesgos',       icon: AlertTriangle, managerOnly: true,  group: 'control'    },
  { id: 'incidents',     label: 'Incidencias',   icon: AlertTriangle, managerOnly: true,  group: 'control'    },
  { id: 'impediments',   label: 'Impedimentos',  icon: ShieldAlert,   managerOnly: false, group: 'control'    },
  { id: 'workload',      label: 'Carga',         icon: Users,         managerOnly: true,  group: 'control'    },
  { id: 'members',       label: 'Equipo',        icon: Users,         managerOnly: false, group: 'people'     },
  { id: 'documents',     label: 'Docs',          icon: FileText,      managerOnly: false, group: 'people'     },
  { id: 'technicaldocs', label: 'Técnicos',      icon: BookOpen,      managerOnly: false, group: 'people'     },
  { id: 'contracts',     label: 'Contratos',     icon: ScrollText,    managerOnly: true,  group: 'people'     },
  { id: 'activity',      label: 'Actividad',     icon: Activity,      managerOnly: false, group: 'people'     },
  { id: 'dod',           label: 'DoD',           icon: CheckSquare,   managerOnly: false, group: 'ceremonies' },
  { id: 'ceremonies',    label: 'Ceremonias',    icon: Clapperboard,  managerOnly: false, group: 'ceremonies' },
  { id: 'meetings',      label: 'Actas',         icon: ClipboardList, managerOnly: false, group: 'ceremonies' },
  // New features
  { id: 'chat',          label: 'Chat',          icon: MessageSquare, managerOnly: false, group: 'people'     },
  { id: 'wiki',          label: 'Wiki',          icon: BookOpen,      managerOnly: false, group: 'people'     },
  { id: 'okrs',          label: 'OKRs',          icon: Target,        managerOnly: false, group: 'control'    },
  { id: 'burnup',        label: 'Burnup',        icon: TrendingUp,    managerOnly: false, group: 'control'    },
  { id: 'capacity',      label: 'Capacidad',     icon: Users,         managerOnly: true,  group: 'control'    },
  { id: 'webhooks',      label: 'Webhooks',      icon: Webhook,       managerOnly: true,  group: 'people'     },
  { id: 'guest',         label: 'Invitados',     icon: Link2,         managerOnly: true,  group: 'people'     },
  // Batch 3 features
  { id: 'automations',   label: 'Automatiz.',    icon: Zap,           managerOnly: true,  group: 'control'    },
  { id: 'releases',      label: 'Releases',      icon: Tag,           managerOnly: true,  group: 'control'    },
  { id: 'standup',       label: 'Standup',       icon: CheckCircle2,  managerOnly: false, group: 'ceremonies' },
  { id: 'weekly',        label: 'Semanales',     icon: Sparkles,      managerOnly: true,  group: 'control'    },
  { id: 'sla',           label: 'SLA',           icon: AlertTriangle, managerOnly: true,  group: 'control'    },
  { id: 'announcements', label: 'Anuncios',      icon: ScrollText,    managerOnly: false, group: 'people'     },
  { id: 'git',           label: 'Git',           icon: Link2,         managerOnly: true,  group: 'people'     },
  { id: 'fields',        label: 'Campos',        icon: ListChecks,    managerOnly: true,  group: 'control'    },
  { id: 'statuses',      label: 'Estados KB',    icon: Layers,        managerOnly: true,  group: 'control'    },
  { id: 'hillchart',     label: 'Hill Chart',    icon: TrendingUp,    managerOnly: false, group: 'control'    },
  { id: 'whatif',        label: 'What-If',       icon: Sparkles,      managerOnly: true,  group: 'control'    },
];

/** Ordered group definitions for the tab bar */
const TAB_GROUPS = [
  { key: 'overview',   label: null },
  { key: 'scrum',      label: 'Scrum' },
  { key: 'control',    label: 'Seguimiento' },
  { key: 'people',     label: 'Equipo & Docs' },
  { key: 'ceremonies', label: 'Ceremonias' },
];

// ─── Main page component ───────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const authUser   = useAuthStore((s) => s.user);

  const [project, setProject] = useState(null);
  const [report,  setReport]  = useState(null);
  const [tab,     setTab]     = useState(searchParams.get('tab') || 'overview');
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);
  const [showCSVImport, setShowCSVImport] = useState(false);

  // Active sprint for burnup/capacity
  const activeSprint = report?.sprints?.find((s) => s.status === 'ACTIVO');

  const loadProject = () => {
    Promise.all([
      projectsAPI.getProject(id),
      projectsAPI.getReportProject(id),
    ]).then(([pr, rr]) => {
      setProject(pr.data);
      setReport(rr.data);
    }).catch(() => toast.error('Error al cargar proyecto'))
      .finally(() => setLoading(false));
  };

  // Hook 1 — load data on mount / id change
  useEffect(() => { loadProject(); }, [id]);

  // Hook 2 — sync URL ?tab= param once project is available.
  // ⚠️ MUST stay before any early return to satisfy Rules of Hooks.
  useEffect(() => {
    if (!project) return;
    const localIsManager =
      authUser?.role === 'ADMIN' ||
      authUser?.role === 'DIRECTOR' ||
      String(authUser?.id) === String(project.director_id) ||
      project.my_project_role === 'PM';
    const localTabs = ALL_TABS.filter((t) => localIsManager || !t.managerOnly);
    const urlTab = searchParams.get('tab');
    if (urlTab && localTabs.find((t) => t.id === urlTab)) {
      setTab(urlTab);
    } else if (urlTab && !localTabs.find((t) => t.id === urlTab)) {
      setTab('overview');
      setSearchParams({}, { replace: true });
    }
  }, [project]);

  const handleDelete = () => {
    setConfirm({
      title: 'Eliminar proyecto',
      body: '¿Eliminar este proyecto? Esta acción no se puede deshacer.',
      onConfirm: async () => {
        try {
          await projectsAPI.deleteProject(id);
          toast.success('Proyecto eliminado');
          navigate('/projects');
        } catch { toast.error('Error al eliminar'); }
      },
    });
  };

  // Early returns — AFTER all hooks
  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-64 text-slate-400">Cargando...</div>
    </Layout>
  );
  if (!project) return (
    <Layout>
      <div className="p-6 text-slate-500">Proyecto no encontrado</div>
    </Layout>
  );

  const isManager =
    authUser?.role === 'ADMIN' ||
    authUser?.role === 'DIRECTOR' ||
    String(authUser?.id) === String(project.director_id) ||
    project.my_project_role === 'PM';
  const tabs = ALL_TABS.filter((t) => isManager || !t.managerOnly);

  const changeTab = (tid) => {
    setTab(tid);
    setSearchParams({ tab: tid }, { replace: true });
  };

  const accent    = STATUS_ACCENT[project.status] ?? STATUS_ACCENT.EJECUCION;
  const ringR     = 38;
  const ringC     = 2 * Math.PI * ringR;
  const ringOffset = ringC * (1 - (project.completion_percentage ?? 0) / 100);

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-4">

        {/* ── Hero header ──────────────────────────────────────────── */}
        <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border-l-4 ${accent.border}`}>
          <div className="p-5">
            <div className="flex items-start gap-4">

              {/* Back */}
              <button
                onClick={() => navigate('/projects')}
                className="mt-1 flex-shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                <ArrowLeft size={20} />
              </button>

              {/* Project meta */}
              <div className="flex-1 min-w-0">
                {/* Code chip + status badge/select */}
                <div className="flex items-center flex-wrap gap-2 mb-2">
                  <span className="text-xs font-mono bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded">
                    {project.code}
                  </span>

                  {isManager ? (
                    <select
                      value={project.status}
                      onChange={async (e) => {
                        const newStatus = e.target.value;
                        try {
                          await projectsAPI.updateProject(project.id, { status: newStatus });
                          toast.success(`Estado: ${STATUS_LABELS[newStatus] ?? newStatus}`);
                          loadProject();
                        } catch { toast.error('Error al cambiar estado'); }
                      }}
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border-0 cursor-pointer
                        focus:outline-none focus:ring-2 focus:ring-indigo-400 appearance-none
                        ${STATUS_COLORS[project.status]}`}>
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
                      ))}
                    </select>
                  ) : (
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_COLORS[project.status]}`}>
                      {STATUS_LABELS[project.status] ?? project.status}
                    </span>
                  )}
                </div>

                {/* Title */}
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 leading-tight">
                  {project.name}
                </h1>

                {/* Metadata strip */}
                <div className="flex items-center flex-wrap gap-x-5 gap-y-1 mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {project.category_name && (
                    <span className="flex items-center gap-1.5">
                      <Tag size={12} className="text-slate-400" />
                      {project.category_name}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Users size={12} className="text-slate-400" />
                    {project.director_first_name} {project.director_last_name}
                  </span>
                  {project.sponsor_first_name && (
                    <span className="flex items-center gap-1.5">
                      <User size={12} className="text-slate-400" />
                      Sponsor: {project.sponsor_first_name} {project.sponsor_last_name}
                    </span>
                  )}
                  {project.planned_start_date && (
                    <span className="flex items-center gap-1.5">
                      <Calendar size={12} className="text-slate-400" />
                      {project.planned_start_date} → {project.planned_end_date ?? '—'}
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                {isManager && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <button onClick={() => setShowCSVImport(true)}
                      className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                      <Upload size={13} /> Importar CSV
                    </button>
                    <Link
                      to={`/projects/${id}/edit`}
                      className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200
                        dark:bg-slate-700 dark:hover:bg-slate-600
                        text-slate-700 dark:text-slate-200 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                      <Edit size={13} /> Editar
                    </Link>
                    <button
                      onClick={handleDelete}
                      className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100
                        dark:bg-red-900/20 dark:hover:bg-red-900/40
                        text-red-600 dark:text-red-400 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                      <Trash2 size={13} /> Eliminar
                    </button>
                  </div>
                )}
              </div>

              {/* SVG progress ring */}
              <div className="flex-shrink-0 flex flex-col items-center gap-1">
                <div className="relative w-24 h-24">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 96 96">
                    <circle cx="48" cy="48" r={ringR} fill="none" stroke="#e2e8f0" strokeWidth="8" />
                    <circle
                      cx="48" cy="48" r={ringR}
                      fill="none"
                      stroke={accent.ring}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={ringC.toFixed(1)}
                      strokeDashoffset={ringOffset.toFixed(1)}
                      className="transition-all duration-700"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-none">
                      {project.completion_percentage ?? 0}%
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">avance</span>
                  </div>
                </div>
                {isManager && project.planned_budget > 0 && (
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    ${Number(project.planned_budget).toLocaleString()}
                  </span>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* ── Tabs + Content ───────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm">

          {/* Tab bar — horizontally scrollable, grouped with separators */}
          <div className="flex overflow-x-auto border-b border-slate-100 dark:border-slate-700">
            {TAB_GROUPS.map((group, gi) => {
              const groupTabs = tabs.filter((t) => t.group === group.key);
              if (!groupTabs.length) return null;
              return (
                <div key={group.key} className="flex items-stretch flex-shrink-0">
                  {/* Group separator */}
                  {gi > 0 && (
                    <div className="flex items-center py-2.5">
                      <div className="w-px h-full bg-slate-200 dark:bg-slate-700 mx-0.5" />
                    </div>
                  )}
                  <div className="flex">
                    {groupTabs.map(({ id: tid, label, icon: Icon }) => (
                      <button
                        key={tid}
                        onClick={() => changeTab(tid)}
                        className={`px-3 py-3 text-xs font-medium whitespace-nowrap transition-colors
                          flex-shrink-0 flex items-center gap-1.5 border-b-2
                          ${tab === tid
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/60 dark:bg-indigo-900/20'
                            : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                        <Icon size={13} className="flex-shrink-0" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tab content panels */}
          <div className="p-5">
            {tab === 'overview'      && <ProjectOverview project={project} report={report} reload={loadProject} isManager={isManager} onTabChange={changeTab} />}
            {tab === 'sprints'       && <SprintList         projectId={id} isManager={isManager} />}
            {tab === 'backlog'       && <BacklogList         projectId={id} isManager={isManager} />}
            {tab === 'planning'      && <SprintPlanningView  projectId={id} />}
            {tab === 'kanban'        && <KanbanBoard         projectId={id} isManager={isManager} />}
            {tab === 'lista'         && <TaskListView        projectId={id} isManager={isManager} />}
            {tab === 'timeline'      && <GanttView           projectId={id} project={project} />}
            {tab === 'depgraph'      && <DependencyGraph     projectId={id} />}
            {tab === 'metrics'       && <SprintMetrics         projectId={id} />}
            {tab === 'milestones'    && <MilestoneList        projectId={id} isManager={isManager} />}
            {tab === 'workload'      && <WorkloadView         projectId={id} />}
            {tab === 'risks'         && <RiskList             projectId={id} isManager={isManager} />}
            {tab === 'incidents'     && <IncidentList         projectId={id} isManager={isManager} />}
            {tab === 'members'       && <MemberList           projectId={id} isManager={isManager} />}
            {tab === 'documents'     && <DocumentList         projectId={id} isManager={isManager} />}
            {tab === 'contracts'     && <ContractList         projectId={id} isManager={isManager} />}
            {tab === 'technicaldocs' && <TechnicalDocList     projectId={id} isManager={isManager} />}
            {tab === 'activity'      && <ActivityFeed         projectId={id} />}
            {tab === 'epics'         && <EpicsList            projectId={id} isManager={isManager} />}
            {tab === 'impediments'   && <ImpedimentLog        projectId={id} isManager={isManager} />}
            {tab === 'dod'           && <DefinitionOfDone     projectId={id} isManager={isManager} />}
            {tab === 'ceremonies'    && <SprintCeremonies     projectId={id} isManager={isManager} />}
            {tab === 'meetings'      && <MeetingMinutes       projectId={id} isManager={isManager} />}
            {tab === 'chat'          && <ProjectChatView      projectId={id} />}
            {tab === 'wiki'          && <WikiView             projectId={id} isManager={isManager} />}
            {tab === 'okrs'          && <OKRsView             projectId={id} isManager={isManager} />}
            {tab === 'burnup'        && (
              activeSprint
                ? <BurnupChart sprintId={activeSprint.id} sprintName={activeSprint.name} />
                : <p className="text-center py-12 text-slate-400">No hay sprint activo para mostrar el burnup.</p>
            )}
            {tab === 'capacity'      && (
              <CapacityView sprintId={activeSprint?.id} sprintName={activeSprint?.name} isManager={isManager} />
            )}
            {tab === 'webhooks'      && <WebhookManager       projectId={id} isManager={isManager} />}
            {tab === 'guest'         && <GuestInviteManager   projectId={id} isManager={isManager} />}
            {tab === 'automations'   && <AutomationsView      projectId={id} isManager={isManager} />}
            {tab === 'releases'      && <ReleasesView         projectId={id} isManager={isManager} />}
            {tab === 'standup'       && <StandupView          projectId={id} isManager={isManager} />}
            {tab === 'weekly'        && <WeeklyReportsView    projectId={id} isManager={isManager} />}
            {tab === 'sla'           && <SLAView              projectId={id} isManager={isManager} />}
            {tab === 'announcements' && <AnnouncementsView    projectId={id} isManager={isManager} />}
            {tab === 'git'           && <GitIntegrationView  projectId={id} isManager={isManager} />}
            {tab === 'fields'        && <CustomFieldsView    projectId={id} isManager={isManager} />}
            {tab === 'statuses'      && <ProjectStatusesView projectId={id} isManager={isManager} />}
            {tab === 'hillchart'     && <HillChart           projectId={id} isManager={isManager} />}
            {tab === 'whatif'        && <WhatIfView          projectId={id} isManager={isManager} />}
          </div>
        </div>

      </div>

      {confirm && <ConfirmModal {...confirm} onClose={() => setConfirm(null)} />}
      {showCSVImport && (
        <CSVImportModal
          projectId={id}
          onClose={() => setShowCSVImport(false)}
          onImported={() => { setShowCSVImport(false); changeTab('kanban'); }}
        />
      )}
    </Layout>
  );
}

// ─── Overview sub-component ───────────────────────────────────────────────────

function ProjectOverview({ project, report, reload, isManager, onTabChange }) {
  const [progress, setProgress] = useState(project.completion_percentage ?? 0);
  const [saving,   setSaving]   = useState(false);

  const saveProgress = async () => {
    setSaving(true);
    try {
      await projectsAPI.updateProgress(project.id, progress);
      toast.success('Progreso actualizado');
      reload();
    } catch { toast.error('Error al actualizar'); }
    finally { setSaving(false); }
  };

  // Derived data
  const ts           = report?.task_stats ?? {};
  const spr          = report?.sprints    ?? [];
  const activeSprint = spr.find((s) => s.status === 'ACTIVO');
  const sprintPct    = activeSprint && Number(activeSprint.total_tasks) > 0
    ? Math.round((Number(activeSprint.completed_tasks) / Number(activeSprint.total_tasks)) * 100)
    : 0;

  // Timeline maths
  const today       = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate     = project.planned_end_date   ? new Date(project.planned_end_date)   : null;
  const startDate   = project.planned_start_date ? new Date(project.planned_start_date) : null;
  const daysLeft    = endDate ? Math.ceil((endDate - today) / 86_400_000) : null;
  const totalDays   = startDate && endDate ? Math.ceil((endDate - startDate) / 86_400_000) : null;
  const elapsed     = startDate && today > startDate ? Math.ceil((today - startDate) / 86_400_000) : 0;
  const timePct     = totalDays && totalDays > 0 ? Math.min(100, Math.round((elapsed / totalDays) * 100)) : 0;

  // Budget
  const planned      = parseFloat(project.planned_budget ?? 0);
  const executed     = parseFloat(project.actual_budget  ?? 0);
  const hourlyRate   = parseFloat(project.hourly_rate    ?? 0);
  // Computed cost from time logs: sum of all logged hours × hourly_rate
  const totalLoggedH = (report?.time_logs_total_hours ?? report?.workload?.total_hours ?? 0);
  const computedCost = hourlyRate > 0 ? Math.round(hourlyRate * parseFloat(totalLoggedH)) : 0;
  const budgetRef    = planned > 0 ? planned : (computedCost > 0 ? computedCost : 0);
  const budgetDisplay = executed > 0 ? executed : computedCost;
  const budgetPct = budgetRef > 0 ? Math.min(100, Math.round((budgetDisplay / budgetRef) * 100)) : 0;

  // Alert sources
  const criticalRisks     = (report?.risks     ?? []).filter((r) => r.status === 'ACTIVO'  && r.probability === 'ALTA' && r.impact === 'ALTO');
  const criticalIncidents  = (report?.incidents ?? []).filter((i) => i.status === 'ABIERTA' && i.severity === 'CRITICA');
  const overdueMilestones  = (report?.milestones ?? []).filter((m) => !parseInt(m.is_completed) && m.due_date && new Date(m.due_date) < today);

  const hasAlerts = criticalRisks.length || criticalIncidents.length || overdueMilestones.length;

  return (
    <div className="space-y-5">

      {/* ── Alert banners ─────────────────────────────────── */}
      {hasAlerts ? (
        <div className="space-y-2">

          {criticalRisks.length > 0 && (
            <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20
              border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
              <AlertTriangle size={15} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                  {criticalRisks.length} riesgo{criticalRisks.length > 1 ? 's' : ''} crítico{criticalRisks.length > 1 ? 's' : ''} activo{criticalRisks.length > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 truncate mt-0.5">
                  {criticalRisks[0].description}
                </p>
              </div>
              {isManager && (
                <button onClick={() => onTabChange('risks')}
                  className="text-xs text-red-600 hover:text-red-700 flex items-center gap-0.5 flex-shrink-0">
                  Ver <ChevronRight size={12} />
                </button>
              )}
            </div>
          )}

          {criticalIncidents.length > 0 && (
            <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20
              border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
              <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  {criticalIncidents.length} incidencia{criticalIncidents.length > 1 ? 's' : ''} crítica{criticalIncidents.length > 1 ? 's' : ''} abierta{criticalIncidents.length > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 truncate mt-0.5">
                  {criticalIncidents[0].title}
                </p>
              </div>
              {isManager && (
                <button onClick={() => onTabChange('incidents')}
                  className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-0.5 flex-shrink-0">
                  Ver <ChevronRight size={12} />
                </button>
              )}
            </div>
          )}

          {overdueMilestones.length > 0 && (
            <div className="flex items-start gap-3 bg-orange-50 dark:bg-orange-900/20
              border border-orange-200 dark:border-orange-800 rounded-xl px-4 py-3">
              <Flag size={15} className="text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">
                  {overdueMilestones.length} hito{overdueMilestones.length > 1 ? 's' : ''} vencido{overdueMilestones.length > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-orange-600 dark:text-orange-400 truncate mt-0.5">
                  {overdueMilestones[0].title}
                </p>
              </div>
              <button onClick={() => onTabChange('milestones')}
                className="text-xs text-orange-600 hover:text-orange-700 flex items-center gap-0.5 flex-shrink-0">
                Ver <ChevronRight size={12} />
              </button>
            </div>
          )}
        </div>
      ) : null}

      {/* ── KPI cards ─────────────────────────────────────── */}
      {report && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label:  'Tareas totales',
              sub:    `${ts.completadas ?? 0} completadas`,
              value:  ts.total ?? 0,
              icon:   ListChecks,
              iconBg: 'bg-indigo-500',
              cardBg: 'bg-indigo-50 dark:bg-indigo-900/20',
            },
            {
              label:  'En progreso',
              sub:    `${ts.vencidas ?? 0} vencidas`,
              value:  ts.en_progreso ?? 0,
              icon:   TrendingUp,
              iconBg: 'bg-blue-500',
              cardBg: 'bg-blue-50 dark:bg-blue-900/20',
            },
            {
              label:  'Bloqueadas',
              sub:    `${ts.criticas ?? 0} de prioridad crítica`,
              value:  ts.bloqueadas ?? 0,
              icon:   AlertTriangle,
              iconBg: (ts.bloqueadas ?? 0) > 0 ? 'bg-red-500' : 'bg-slate-400',
              cardBg: (ts.bloqueadas ?? 0) > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-slate-50 dark:bg-slate-700/50',
            },
            {
              label:  'Horas registradas',
              sub:    `de ${parseFloat(ts.horas_estimadas ?? 0).toFixed(0)}h estimadas`,
              value:  `${parseFloat(ts.horas_registradas ?? 0).toFixed(0)}h`,
              icon:   Clock,
              iconBg: 'bg-emerald-500',
              cardBg: 'bg-emerald-50 dark:bg-emerald-900/20',
            },
          ].map(({ label, value, sub, icon: Icon, iconBg, cardBg }) => (
            <div key={label} className={`${cardBg} rounded-xl p-4`}>
              <div className={`${iconBg} w-8 h-8 rounded-lg flex items-center justify-center mb-3`}>
                <Icon size={15} className="text-white" />
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-50 leading-none">{value}</p>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1">{label}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Active sprint + Milestones ────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* Sprint card */}
        {activeSprint ? (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50
            dark:from-blue-900/20 dark:to-indigo-900/20
            border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse inline-block" />
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                    Sprint Activo
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {activeSprint.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {activeSprint.start_date} → {activeSprint.end_date}
                </p>
              </div>
              <button
                onClick={() => onTabChange('sprints')}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 flex items-center gap-0.5 flex-shrink-0">
                Ver <ChevronRight size={12} />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                  <span>Completadas</span>
                  <span className="font-semibold">
                    {activeSprint.completed_tasks}/{activeSprint.total_tasks}
                  </span>
                </div>
                <div className="h-2.5 bg-blue-200 dark:bg-blue-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${sprintPct}%` }}
                  />
                </div>
              </div>
              <span className="text-2xl font-bold text-blue-700 dark:text-blue-300 flex-shrink-0 w-12 text-right">
                {sprintPct}%
              </span>
            </div>

            {parseFloat(activeSprint.estimated_hours ?? 0) > 0 && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 flex items-center gap-1">
                <Clock size={11} />
                {parseFloat(activeSprint.time_logged ?? 0).toFixed(0)}h &nbsp;/&nbsp;
                {parseFloat(activeSprint.estimated_hours).toFixed(0)}h estimadas
              </p>
            )}
          </div>
        ) : (
          <div className="border border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-5
            flex flex-col items-center justify-center text-center gap-2">
            <Zap size={26} className="text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Sin sprint activo</p>
            <button
              onClick={() => onTabChange('sprints')}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
              Gestionar sprints
            </button>
          </div>
        )}

        {/* Milestones list */}
        {(report?.milestones ?? []).length > 0 ? (
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                <Flag size={12} /> Hitos ({report.milestones.length})
              </h3>
              <button
                onClick={() => onTabChange('milestones')}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 flex items-center gap-0.5">
                Ver todos <ChevronRight size={12} />
              </button>
            </div>
            <div className="space-y-2.5">
              {report.milestones.slice(0, 5).map((m) => {
                const isDone    = parseInt(m.is_completed);
                const isOverdue = !isDone && m.due_date && new Date(m.due_date) < today;
                return (
                  <div key={m.id} className="flex items-center gap-2.5">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isDone    ? 'bg-emerald-500'
                      : isOverdue ? 'bg-red-400'
                      : 'bg-slate-300 dark:bg-slate-600'
                    }`}>
                      {isDone && <CheckCircle2 size={11} className="text-white" />}
                    </div>
                    <span className={`text-xs flex-1 truncate ${
                      isDone    ? 'line-through text-slate-400'
                      : isOverdue ? 'text-red-700 dark:text-red-400 font-medium'
                      : 'text-slate-700 dark:text-slate-300'
                    }`}>
                      {m.title}
                    </span>
                    <span className={`text-[10px] flex-shrink-0 ${
                      isDone    ? 'text-emerald-500'
                      : isOverdue ? 'text-red-500 font-semibold'
                      : 'text-slate-400'
                    }`}>
                      {m.due_date}
                    </span>
                  </div>
                );
              })}
              {report.milestones.length > 5 && (
                <p className="text-xs text-slate-400 text-center pt-0.5">
                  +{report.milestones.length - 5} hitos más
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="border border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-5
            flex flex-col items-center justify-center text-center gap-2">
            <Flag size={26} className="text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Sin hitos definidos</p>
            <button
              onClick={() => onTabChange('milestones')}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
              Agregar hitos
            </button>
          </div>
        )}
      </div>

      {/* ── Timeline + Budget ─────────────────────────────── */}
      {(totalDays !== null || (isManager && planned > 0)) && (
        <div className="grid md:grid-cols-2 gap-4">

          {/* Timeline */}
          {totalDays !== null && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Calendar size={12} className="text-indigo-500" /> Línea de Tiempo
                </h3>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  daysLeft === null                   ? 'bg-slate-100 text-slate-500'
                  : daysLeft < 0                     ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                  : daysLeft <= 7                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                }`}>
                  {daysLeft === null ? '—'
                    : daysLeft < 0  ? `Vencido ${Math.abs(daysLeft)}d`
                    : daysLeft === 0 ? 'Vence hoy'
                    : `${daysLeft}d restantes`}
                </span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all ${daysLeft !== null && daysLeft < 0 ? 'bg-red-500' : 'bg-indigo-500'}`}
                  style={{ width: `${timePct}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>{project.planned_start_date}</span>
                <span className="font-medium text-slate-500 dark:text-slate-400">{timePct}% del tiempo</span>
                <span>{project.planned_end_date}</span>
              </div>
            </div>
          )}

          {/* Budget */}
          {isManager && (planned > 0 || hourlyRate > 0) && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                  <TrendingUp size={12} className="text-emerald-500" /> Presupuesto
                </h3>
                {budgetRef > 0 && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    budgetPct > 100 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    : budgetPct > 80 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                  }`}>
                    {budgetPct}% ejecutado
                  </span>
                )}
              </div>
              {budgetRef > 0 && (
                <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all ${budgetPct > 100 ? 'bg-red-500' : budgetPct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, budgetPct)}%` }}
                  />
                </div>
              )}
              <div className="space-y-1 text-xs text-slate-400">
                {planned > 0 && (
                  <div className="flex justify-between">
                    <span>Planeado:</span>
                    <span className="font-medium text-slate-600 dark:text-slate-300">${Number(planned).toLocaleString()}</span>
                  </div>
                )}
                {executed > 0 && (
                  <div className="flex justify-between">
                    <span>Ejecutado:</span>
                    <span className={`font-medium ${budgetPct > 100 ? 'text-red-600' : 'text-slate-600 dark:text-slate-300'}`}>
                      ${Number(executed).toLocaleString()}
                    </span>
                  </div>
                )}
                {hourlyRate > 0 && (
                  <div className="flex justify-between border-t border-slate-100 dark:border-slate-700 pt-1 mt-1">
                    <span>Tarifa/hora:</span>
                    <span className="font-medium text-slate-600 dark:text-slate-300">${hourlyRate}/h</span>
                  </div>
                )}
                {hourlyRate > 0 && parseFloat(totalLoggedH) > 0 && (
                  <div className="flex justify-between">
                    <span>Costo estimado ({parseFloat(totalLoggedH).toFixed(1)}h registradas):</span>
                    <span className={`font-medium ${computedCost > planned && planned > 0 ? 'text-red-600' : 'text-indigo-600 dark:text-indigo-400'}`}>
                      ${computedCost.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── AI Summary ──────────────────────────────────── */}
      <AIProjectSummary projectId={project.id} isManager={isManager} />

      {/* ── EVM Widget ──────────────────────────────────── */}
      <EVMWidget project={project} />

      {/* ── Delivery Prediction ─────────────────────────── */}
      <DeliveryPrediction projectId={project.id} />

      {/* ── Team strip ────────────────────────────────────── */}
      {(report?.members ?? []).length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
              <Users size={12} /> Equipo ({report.members.length} miembros)
            </h3>
            <button
              onClick={() => onTabChange('members')}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 flex items-center gap-0.5">
              Ver todos <ChevronRight size={12} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {report.members.slice(0, 10).map((m, i) => (
              <div
                key={i}
                className="flex items-center gap-2 bg-white dark:bg-slate-800
                  border border-slate-100 dark:border-slate-700 rounded-lg px-2.5 py-1.5 shadow-sm">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center
                  text-xs font-bold text-white flex-shrink-0 ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                  {(m.first_name?.[0] ?? '')}{(m.last_name?.[0] ?? '')}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate leading-tight">
                    {m.first_name} {m.last_name}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                    {m.role || m.position || '—'}
                  </p>
                </div>
              </div>
            ))}
            {report.members.length > 10 && (
              <div className="flex items-center justify-center h-11 px-3 text-xs text-slate-400
                bg-white dark:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                +{report.members.length - 10} más
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Project info ──────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">
        {project.description && (
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
              Descripción
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
              {project.description}
            </p>
          </div>
        )}
        {project.objectives && (
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
              Objetivos
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
              {project.objectives}
            </p>
          </div>
        )}
        {project.scope && (
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
              Alcance
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
              {project.scope}
            </p>
          </div>
        )}
        {project.client_name && (
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
              Cliente
            </h3>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{project.client_name}</p>
            {project.client_email && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{project.client_email}</p>
            )}
            {project.client_phone && (
              <p className="text-xs text-slate-500 dark:text-slate-400">{project.client_phone}</p>
            )}
          </div>
        )}
      </div>

      {/* ── Progress slider (manager only) ────────────────── */}
      {isManager && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
            Actualizar Progreso
          </h3>
          <div className="flex items-center gap-4">
            <input
              type="range" min="0" max="100" value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="flex-1 accent-indigo-600"
            />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 w-10 text-right">
              {progress}%
            </span>
            <button
              onClick={saveProgress}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60
                text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors flex-shrink-0">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
