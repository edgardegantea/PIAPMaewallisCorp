import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { projectsAPI } from '../services/projectsAPI';
import {
  Shield, Calendar, Users, Flag, AlertTriangle, CheckCircle2,
  Clock, CircleDot, DollarSign, TrendingUp, FileText, Briefcase,
  ChevronDown, ChevronUp, MapPin, Link as LinkIcon,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_LABELS = {
  PLANIFICACION:'Planificación', EJECUCION:'Ejecución', SEGUIMIENTO:'Seguimiento',
  MONITOREO:'Monitoreo', CIERRE:'Cierre', COMPLETADO:'Completado', CANCELADO:'Cancelado',
  INICIACION:'Iniciación', PLANIFICACION2:'Planificación',
};
const STATUS_COLORS = {
  EJECUCION:  'bg-blue-100 text-blue-700',
  CIERRE:     'bg-emerald-100 text-emerald-700',
  COMPLETADO: 'bg-emerald-100 text-emerald-700',
  CANCELADO:  'bg-red-100 text-red-700',
  PAUSADO:    'bg-slate-100 text-slate-600',
};

function fmt(n) {
  return Number(n ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T12:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}
function daysLeft(d) {
  if (!d) return null;
  return Math.ceil((new Date(d + 'T12:00') - new Date()) / 86400000);
}

const RISK_COLORS = {
  CRITICO: 'bg-red-100 text-red-700',
  ALTO:    'bg-orange-100 text-orange-700',
  MEDIO:   'bg-amber-100 text-amber-700',
  BAJO:    'bg-slate-100 text-slate-600',
};

const PAY_STATUS = {
  pendiente: { label:'Pendiente', cls:'bg-amber-100 text-amber-700', icon: Clock       },
  pagado:    { label:'Pagado',    cls:'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  atrasado:  { label:'Atrasado',  cls:'bg-red-100 text-red-700',    icon: AlertTriangle },
  cancelado: { label:'Cancelado', cls:'bg-slate-100 text-slate-500', icon: Clock        },
};

const BUDGET_CATS = {
  materiales:'Materiales', mano_obra:'Mano de obra', equipos:'Equipos',
  servicios:'Servicios',   viajes:'Viajes',           otros:'Otros',
};

// ─────────────────────────────────────────────────────────────────────────────
// Section card wrapper
// ─────────────────────────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-2 font-semibold text-slate-800">
          <Icon size={16} className="text-indigo-500"/>
          {title}
        </div>
        {open ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
      </button>
      {open && <div className="px-6 pb-5 border-t border-slate-100">{children}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GuestPage
// ─────────────────────────────────────────────────────────────────────────────

export default function GuestPage() {
  const { token }             = useParams();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    projectsAPI.getGuestView(token)
      .then(r  => setData(r.data))
      .catch(e => setError(e?.response?.data?.message || 'Enlace no válido'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="text-slate-400 text-sm animate-pulse">Cargando portal del cliente…</div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="text-center p-8 bg-white rounded-2xl shadow border border-slate-200 max-w-sm">
        <Shield size={40} className="mx-auto mb-3 text-red-400"/>
        <h1 className="text-lg font-bold text-slate-800 mb-2">Acceso denegado</h1>
        <p className="text-sm text-slate-500">{error}</p>
      </div>
    </div>
  );

  const { project, sprints = [], milestones = [], risks = [], task_stats = [],
          budget_summary = [], payments = [], members = [], documents = [], invite } = data;

  // Task stats
  const taskMap    = task_stats.reduce((a, r) => ({ ...a, [r.status]: parseInt(r.cnt) }), {});
  const totalTasks = Object.values(taskMap).reduce((s, n) => s + n, 0);
  const doneTasks  = taskMap['COMPLETADA'] || 0;
  const inProgress = taskMap['EN_PROGRESO'] || 0;
  const pct        = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // Budget totals
  const budgetPlanned = budget_summary.reduce((s, r) => s + parseFloat(r.planned ?? 0), 0);
  const budgetActual  = budget_summary.reduce((s, r) => s + parseFloat(r.actual  ?? 0), 0);
  const budgetPct     = budgetPlanned > 0 ? Math.min(100, Math.round((budgetActual / budgetPlanned) * 100)) : 0;

  // Payments
  const payTotal   = payments.reduce((s, p) => s + parseFloat(p.amount ?? 0), 0);
  const payPaid    = payments.filter(p => p.status === 'pagado').reduce((s, p) => s + parseFloat(p.amount), 0);
  const payOverdue = payments.filter(p => p.status === 'atrasado').length;

  // Milestones upcoming
  const upcoming = milestones.filter(m => !m.completed_at).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  return (
    <div className="min-h-screen bg-slate-100">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3">
        <Shield size={16} className="text-indigo-500 flex-shrink-0"/>
        <span className="text-sm font-semibold text-slate-700">{project.name}</span>
        <span className="text-xs text-slate-400">· Portal de cliente — solo lectura</span>
        {invite?.label && <span className="text-xs text-slate-400 ml-auto">{invite.label}</span>}
        {invite?.expires_at && (
          <span className="text-xs text-amber-500">Expira: {fmtDate(invite.expires_at)}</span>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* ── Project header ───────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[project.status] ?? 'bg-slate-100 text-slate-600'}`}>
                  {STATUS_LABELS[project.status] ?? project.status}
                </span>
              </div>
              {project.description && <p className="text-sm text-slate-500 mt-1">{project.description}</p>}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-3xl font-bold text-indigo-600">{pct}%</p>
              <p className="text-xs text-slate-500">completado</p>
            </div>
          </div>

          {/* Progress */}
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mb-4">
            <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : pct > 60 ? 'bg-indigo-500' : pct > 30 ? 'bg-amber-500' : 'bg-red-400'}`}
              style={{ width: `${pct}%` }}/>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            {[
              { label: 'Inicio',      value: fmtDate(project.start_date)    },
              { label: 'Fin previsto',value: fmtDate(project.planned_end_date) },
              { label: 'Tareas completadas', value: `${doneTasks} / ${totalTasks}` },
              { label: 'En progreso', value: `${inProgress} tarea${inProgress !== 1 ? 's' : ''}` },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-slate-400">{label}</p>
                <p className="font-semibold text-slate-800">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── KPI row ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Hitos pendientes', value: upcoming.length,    icon: Flag,        color: 'indigo'  },
            { label: 'Riesgos activos',  value: risks.length,       icon: AlertTriangle,color: risks.length > 0 ? 'red' : 'emerald' },
            { label: 'Miembros equipo',  value: members.length,     icon: Users,       color: 'blue'    },
            { label: 'Pagos atrasados',  value: payOverdue,         icon: DollarSign,  color: payOverdue > 0 ? 'red' : 'emerald' },
          ].map(({ label, value, icon: Icon, color }) => {
            const colors = { indigo:'text-indigo-600', red:'text-red-500', emerald:'text-emerald-600', blue:'text-blue-600' };
            return (
              <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
                <Icon size={18} className={`flex-shrink-0 ${colors[color]}`}/>
                <div>
                  <p className={`text-xl font-bold ${colors[color]}`}>{value}</p>
                  <p className="text-xs text-slate-500">{label}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Milestones ───────────────────────────────────────────────── */}
        {milestones.length > 0 && (
          <Section title="Hitos del proyecto" icon={Flag}>
            <div className="mt-4 space-y-3">
              {milestones.map(m => {
                const dl    = daysLeft(m.due_date);
                const done  = !!m.completed_at;
                return (
                  <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${done ? 'bg-emerald-100 text-emerald-600' : dl != null && dl < 0 ? 'bg-red-100 text-red-500' : dl != null && dl <= 7 ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'}`}>
                      {done ? <CheckCircle2 size={14}/> : <Clock size={14}/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{m.title}</p>
                      <p className="text-xs text-slate-400">{fmtDate(m.due_date)}</p>
                    </div>
                    {!done && dl != null && (
                      <span className={`text-xs font-medium flex-shrink-0 ${dl < 0 ? 'text-red-500' : dl <= 7 ? 'text-amber-600' : 'text-slate-500'}`}>
                        {dl < 0 ? `${Math.abs(dl)}d atrás` : dl === 0 ? 'Hoy' : `${dl}d`}
                      </span>
                    )}
                    {done && <span className="text-xs text-emerald-600 font-medium flex-shrink-0">✓ Completado</span>}
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* ── Sprints ──────────────────────────────────────────────────── */}
        {sprints.length > 0 && (
          <Section title="Sprints" icon={CircleDot} defaultOpen={false}>
            <div className="mt-4 space-y-2">
              {sprints.map(s => {
                const done  = s.status === 'COMPLETADO';
                const active= s.status === 'ACTIVO';
                return (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${active ? 'bg-emerald-500 animate-pulse' : done ? 'bg-slate-400' : 'bg-slate-300'}`}/>
                      <span className="text-sm font-medium text-slate-700">{s.name ?? `Sprint ${s.number}`}</span>
                    </div>
                    <div className="text-right text-xs text-slate-400">
                      <p>{fmtDate(s.start_date)} → {fmtDate(s.end_date)}</p>
                      <span className={`font-medium ${active ? 'text-emerald-600' : done ? 'text-slate-500' : 'text-slate-400'}`}>
                        {active ? 'Activo' : done ? 'Completado' : 'Pendiente'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* ── Budget ───────────────────────────────────────────────────── */}
        {(budgetPlanned > 0 || budget_summary.length > 0) && (
          <Section title="Presupuesto" icon={Briefcase}>
            <div className="mt-4 space-y-3">
              {/* Bar */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600">Ejecución presupuestal</span>
                  <span className={`font-bold ${budgetPct > 100 ? 'text-red-600' : budgetPct > 80 ? 'text-amber-600' : 'text-emerald-600'}`}>{budgetPct}%</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${budgetPct > 100 ? 'bg-red-500' : budgetPct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, budgetPct)}%` }}/>
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>Planificado: ${fmt(budgetPlanned)}</span>
                  <span>Ejecutado: ${fmt(budgetActual)}</span>
                </div>
              </div>
              {/* Categories */}
              {budget_summary.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                  {budget_summary.map(s => (
                    <div key={s.category} className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                      <p className="text-xs text-slate-500">{BUDGET_CATS[s.category] ?? s.category}</p>
                      <p className="text-sm font-semibold text-slate-800">${fmt(s.actual)}</p>
                      <p className="text-xs text-slate-400">de ${fmt(s.planned)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Payments ─────────────────────────────────────────────────── */}
        {payments.length > 0 && (
          <Section title="Cronograma de pagos" icon={DollarSign}>
            <div className="mt-4 space-y-2">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label:'Total', value:`$${fmt(payTotal)}`, color:'text-slate-800' },
                  { label:'Cobrado', value:`$${fmt(payPaid)}`, color:'text-emerald-600' },
                  { label:'Pendiente', value:`$${fmt(payTotal - payPaid)}`, color:'text-amber-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-slate-50 rounded-xl px-3 py-2 border border-slate-100 text-center">
                    <p className={`font-bold ${color}`}>{value}</p>
                    <p className="text-xs text-slate-400">{label}</p>
                  </div>
                ))}
              </div>
              {payments.map(p => {
                const st = PAY_STATUS[p.status] ?? PAY_STATUS.pendiente;
                const StIcon = st.icon;
                return (
                  <div key={p.concept + p.due_date} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className={`p-1.5 rounded-lg ${st.cls} flex-shrink-0`}><StIcon size={12}/></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{p.concept}</p>
                      <p className="text-xs text-slate-400">Vence: {fmtDate(p.due_date)}{p.paid_at ? ` · Pagado: ${fmtDate(p.paid_at)}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      <span className="font-mono font-semibold text-slate-800 text-sm">${fmt(p.amount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* ── Risks ────────────────────────────────────────────────────── */}
        {risks.length > 0 && (
          <Section title={`Riesgos activos (${risks.length})`} icon={AlertTriangle} defaultOpen={false}>
            <div className="mt-4 space-y-2">
              {risks.map((r, i) => {
                const level = r.impact === 'ALTO' || r.probability === 'ALTA' ? 'ALTO' : 'MEDIO';
                return (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 mt-0.5 ${RISK_COLORS[level] ?? RISK_COLORS.MEDIO}`}>
                      {level}
                    </span>
                    <p className="text-sm text-slate-700">{r.description}</p>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* ── Team ─────────────────────────────────────────────────────── */}
        {members.length > 0 && (
          <Section title="Equipo del proyecto" icon={Users} defaultOpen={false}>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {members.map((m, i) => {
                const colors = ['bg-indigo-500','bg-violet-500','bg-blue-500','bg-emerald-500','bg-amber-500','bg-rose-500'];
                const bg = colors[i % colors.length];
                const initials = (m.name ?? '?').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
                return (
                  <div key={i} className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className={`w-8 h-8 rounded-full ${bg} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>{initials}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{m.name}</p>
                      <p className="text-xs text-slate-400 truncate">{m.position ?? m.project_role ?? '—'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* ── Documents ────────────────────────────────────────────────── */}
        {documents.length > 0 && (
          <Section title="Documentos recientes" icon={FileText} defaultOpen={false}>
            <div className="mt-4 space-y-2">
              {documents.map((d, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <FileText size={14} className="text-indigo-400 flex-shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{d.title}</p>
                    <p className="text-xs text-slate-400">{d.type ?? 'Documento'} · {fmtDate(d.created_at?.slice(0,10))}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 py-2">
          Portal generado por PIAP MaeWallisCorp · Acceso de solo lectura
        </p>
      </div>
    </div>
  );
}
