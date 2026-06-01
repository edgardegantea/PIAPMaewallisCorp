import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { projectsAPI } from '../services/projectsAPI';
import Layout from '../components/Layout';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';
import {
  FolderKanban, CheckCircle2, AlertTriangle, Clock,
  TrendingUp, DollarSign, Flag, Download, Calendar, FileSpreadsheet, FileText,
} from 'lucide-react';

/* ── PDF export (jsPDF + autoTable) ─────────────────────────────── */
async function exportTimePDF(timeData, from, to, projectLabel = 'Todos') {
  const { jsPDF } = await import('jspdf');
  const autoTable  = (await import('jspdf-autotable')).default;

  const doc  = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const now  = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

  // Header
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, 297, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Reporte de Horas Registradas', 14, 11);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Período: ${from} → ${to}  |  Proyecto: ${projectLabel}  |  Generado: ${now}`, 14, 16);

  // Summary by user
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen por usuario', 14, 26);

  autoTable(doc, {
    startY: 29,
    head: [['Usuario', 'Registros', 'Horas']],
    body: [
      ...(timeData.by_user || []).map(u => [u.user_name, u.entries, `${parseFloat(u.total_hours).toFixed(1)}h`]),
      [{ content: 'TOTAL', styles: { fontStyle: 'bold' } }, '', { content: `${timeData.grand_total}h`, styles: { fontStyle: 'bold', textColor: [99, 102, 241] } }],
    ],
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 25, halign: 'center' }, 2: { cellWidth: 25, halign: 'right' } },
  });

  // Detail table
  const afterSummary = doc.lastAutoTable.finalY + 6;
  doc.setFont('helvetica', 'bold');
  doc.text(`Detalle (${timeData.rows?.length ?? 0} registros)`, 14, afterSummary);

  autoTable(doc, {
    startY: afterSummary + 3,
    head: [['Fecha', 'Usuario', 'Proyecto', 'Tarea', 'Horas', 'Descripción']],
    body: (timeData.rows || []).map(r => [
      r.work_date,
      r.user_name,
      `${r.project_code} — ${r.project_name}`,
      r.task_title,
      `${parseFloat(r.hours).toFixed(1)}h`,
      r.description || '',
    ]),
    theme: 'striped',
    headStyles: { fillColor: [15, 118, 110], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 40 },
      2: { cellWidth: 55 },
      3: { cellWidth: 60 },
      4: { cellWidth: 16, halign: 'right' },
      5: { cellWidth: 'auto' },
    },
  });

  // Footer
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`Página ${i} de ${pages}`, 283, 205, { align: 'right' });
  }

  doc.save(`reporte_horas_${from}_${to}.pdf`);
}

/* ── Excel export ────────────────────────────────────────────────── */
async function exportTimeExcel(timeData, from, to) {
  const XLSX = await import('xlsx');
  const wb   = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = [
    ['Reporte de Horas', `${from} → ${to}`],
    [],
    ['Usuario', 'Registros', 'Horas'],
    ...(timeData.by_user || []).map(u => [u.user_name, Number(u.entries), parseFloat(u.total_hours)]),
    [],
    ['TOTAL', '', parseFloat(timeData.grand_total)],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'Resumen');

  // Detail sheet
  const detailData = [
    ['Fecha', 'Usuario', 'Email', 'Proyecto', 'Código', 'Tarea', 'Estado tarea', 'Horas', 'Descripción'],
    ...(timeData.rows || []).map(r => [
      r.work_date, r.user_name, r.email,
      r.project_name, r.project_code,
      r.task_title, r.task_status,
      parseFloat(r.hours), r.description || '',
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detailData), 'Detalle');

  XLSX.writeFile(wb, `reporte_horas_${from}_${to}.xlsx`);
}

/* ── helpers ───────────────────────────────────────────────────── */
const fmt = (d) => new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

function getPeriodDates(period) {
  const now   = new Date();
  const today = now.toISOString().slice(0, 10);
  switch (period) {
    case 'week': {
      const day    = now.getDay() || 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - day + 1);
      return { from: monday.toISOString().slice(0, 10), to: today };
    }
    case 'fortnight': {
      const d    = now.getDate();
      const from = new Date(now.getFullYear(), now.getMonth(), d <= 15 ? 1 : 16);
      return { from: from.toISOString().slice(0, 10), to: today };
    }
    case 'month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), to: today };
    case 'prev_month': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to   = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
    }
    case 'quarter': {
      const from = new Date(now);
      from.setMonth(from.getMonth() - 3);
      return { from: from.toISOString().slice(0, 10), to: today };
    }
    case 'year':
      return { from: `${now.getFullYear()}-01-01`, to: today };
    default:
      return { from: today, to: today };
  }
}

const STATUS_COLORS = {
  INICIACION: '#6366f1', PLANIFICACION: '#8b5cf6', EJECUCION: '#3b82f6',
  MONITOREO: '#f59e0b', CIERRE: '#10b981', PAUSADO: '#94a3b8', CANCELADO: '#ef4444',
};
const STATUS_LABELS = {
  INICIACION: 'Iniciación', PLANIFICACION: 'Planificación', EJECUCION: 'Ejecución',
  MONITOREO: 'Monitoreo', CIERRE: 'Cierre', PAUSADO: 'Pausado', CANCELADO: 'Cancelado',
};
const ROLE_LABELS = { ADMIN: 'Admin', DIRECTOR: 'Director', PM: 'PM', TEAM_MEMBER: 'Team Member' };

/* ── subcomponents ─────────────────────────────────────────────── */
function StatCard({ label, value, sub, icon: Icon, color = 'bg-indigo-500' }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5 flex items-center gap-4">
      <div className={`${color} p-3 rounded-lg text-white flex-shrink-0`}><Icon size={20} /></div>
      <div>
        <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value ?? '—'}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color = 'text-slate-800' }) {
  return (
    <div className="text-center">
      <p className={`text-2xl font-bold ${color} dark:text-slate-100`}>{value ?? 0}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

const PERIODS = [
  { key: 'week',       label: 'Esta semana' },
  { key: 'fortnight',  label: 'Quincena' },
  { key: 'month',      label: 'Este mes' },
  { key: 'prev_month', label: 'Mes anterior' },
  { key: 'quarter',    label: 'Trimestre' },
  { key: 'year',       label: 'Este año' },
  { key: 'custom',     label: 'Personalizado' },
];

/* ── main component ────────────────────────────────────────────── */
export default function ReportsPage() {
  // Overview (global)
  const [overview, setOverview]   = useState(null);
  const [loadingOv, setLoadingOv] = useState(true);

  // Range report
  const [period, setPeriod]         = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]     = useState('');
  const [range, setRange]           = useState(null);
  const [loadingRange, setLoadingRange] = useState(false);

  useEffect(() => {
    projectsAPI.getReportOverview()
      .then((r) => setOverview(r.data))
      .finally(() => setLoadingOv(false));
  }, []);

  const loadRange = useCallback((p, cf, ct) => {
    let from, to;
    if (p === 'custom') {
      if (!cf || !ct) return;
      from = cf; to = ct;
    } else {
      ({ from, to } = getPeriodDates(p));
    }
    setLoadingRange(true);
    projectsAPI.getReportRange({ from, to })
      .then((r) => setRange(r.data))
      .catch(() => setRange(null))
      .finally(() => setLoadingRange(false));
  }, []);

  // Carga el período cuando cambia (y también en el montaje inicial porque period empieza en 'month')
  useEffect(() => {
    if (period !== 'custom') loadRange(period, '', '');
  }, [period, loadRange]);

  // ── Time report ─────────────────────────────────────────────────────────
  const [timeFrom, setTimeFrom]         = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [timeTo, setTimeTo]             = useState(() => new Date().toISOString().slice(0, 10));
  const [timeProjectId, setTimeProjectId] = useState('');
  const [timeData, setTimeData]         = useState(null);
  const [loadingTime, setLoadingTime]   = useState(false);
  const [projects, setProjects]         = useState([]);

  useEffect(() => {
    projectsAPI.getProjects().then((r) => setProjects(r.data)).catch(() => {});
  }, []);

  const loadTimeReport = () => {
    setLoadingTime(true);
    projectsAPI.getTimeReport({ from: timeFrom, to: timeTo, project_id: timeProjectId || undefined })
      .then((r) => setTimeData(r.data))
      .catch(() => setTimeData(null))
      .finally(() => setLoadingTime(false));
  };

  const exportTimeCSV = () => {
    if (!timeData?.rows) return;
    const rows = [
      ['Fecha', 'Horas', 'Proyecto', 'Tarea', 'Usuario', 'Descripción'],
      ...timeData.rows.map((r) => [r.work_date, r.hours, r.project_name, r.task_title, r.user_name, r.description || '']),
      [],
      ['TOTAL', timeData.grand_total, '', '', '', ''],
    ];
    const csv = '﻿' + rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `timelogs_${timeFrom}_${timeTo}.csv` });
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  /* PDF export — usa el diálogo de impresión del navegador */
  const exportPDF = () => window.print();

  /* CSV export */
  const exportCSV = () => {
    if (!overview) return;
    const p = overview.projects || {}, t = overview.tasks || {};
    const budgetUsed = p.presupuesto_total > 0 ? Math.round(p.presupuesto_ejecutado / p.presupuesto_total * 100) : 0;
    const rows = [
      ['Tipo','Métrica','Valor'],
      ['Proyectos','Total', p.total ?? 0],
      ['Proyectos','En Ejecución', p.en_ejecucion ?? 0],
      ['Proyectos','Avance Promedio', `${p.avance_promedio ?? 0}%`],
      ['Tareas','Total', t.total ?? 0],
      ['Tareas','Completadas', t.completadas ?? 0],
      ['Tareas','Bloqueadas', t.bloqueadas ?? 0],
      ['Tareas','Horas Estimadas', `${parseFloat(t.horas_estimadas||0).toFixed(1)}h`],
      ['Tareas','Horas Registradas', `${parseFloat(t.horas_registradas||0).toFixed(1)}h`],
      ['Presupuesto','Total', Number(p.presupuesto_total||0)],
      ['Presupuesto','Ejecutado', `${budgetUsed}%`],
    ];
    const csv = '﻿' + rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `reporte_${new Date().toISOString().slice(0,10)}.csv` });
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  if (loadingOv) return <Layout><div className="flex items-center justify-center h-64 text-slate-400">Cargando...</div></Layout>;

  const p   = overview?.projects  || {};
  const t   = overview?.tasks     || {};
  const m   = overview?.milestones || {};
  const r   = overview?.risks     || {};
  const inc = overview?.incidents || {};

  const byStatusChart    = (overview?.by_status  || []).map((s) => ({ name: STATUS_LABELS[s.status] || s.status, value: parseInt(s.count), color: STATUS_COLORS[s.status] || '#94a3b8' }));
  const byCategoryChart  = (overview?.by_category || []).map((c) => ({ name: c.category, value: parseInt(c.count), fill: c.color || '#6366f1' }));
  const hoursChart       = (overview?.hours_by_project || []).map((h) => ({ name: h.name.length > 18 ? h.name.slice(0,16)+'…' : h.name, estimadas: parseFloat(h.estimadas), registradas: parseFloat(h.registradas) }));
  const budgetUsed       = p.presupuesto_total > 0 ? Math.round(p.presupuesto_ejecutado / p.presupuesto_total * 100) : 0;
  const taskCompletion   = t.total > 0 ? Math.round(t.completadas / t.total * 100) : 0;

  /* Range data */
  const tc  = range?.tasks_created   || {};
  const tco = range?.tasks_completed || {};
  const hr  = range?.hours           || {};
  const pc  = range?.projects_created || {};
  const rc  = range?.risks_created   || {};
  const ic  = range?.incidents_created || {};
  const hoursUserChart = (range?.hours_by_user || []).map((u) => ({
    name:  `${u.first_name} ${u.last_name}`.trim() || u.username,
    horas: parseFloat(u.horas),
    tareas: parseInt(u.tareas),
  }));

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-6">

        {/* ── SECCIÓN 0: Reporte de tiempo detallado ──────────────── */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-emerald-500" />
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Reporte de tiempo</h2>
              {timeData && (
                <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">
                  {timeData.grand_total}h total
                </span>
              )}
            </div>
            {timeData && (
              <div className="flex items-center gap-2 print:hidden">
                <button onClick={exportTimeCSV}
                  className="flex items-center gap-1.5 text-xs border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg transition-colors">
                  <Download size={12} /> CSV
                </button>
                <button onClick={() => exportTimeExcel(timeData, timeFrom, timeTo)}
                  className="flex items-center gap-1.5 text-xs border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-lg transition-colors">
                  <FileSpreadsheet size={12} /> Excel
                </button>
                <button onClick={() => {
                  const label = projects.find(p => String(p.id) === timeProjectId)?.name || 'Todos';
                  exportTimePDF(timeData, timeFrom, timeTo, label);
                }}
                  className="flex items-center gap-1.5 text-xs border border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-700 dark:text-red-400 px-3 py-1.5 rounded-lg transition-colors">
                  <FileText size={12} /> PDF
                </button>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div>
              <label className="block text-xs text-slate-500 mb-0.5">Desde</label>
              <input type="date" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)}
                className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:text-slate-100" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-0.5">Hasta</label>
              <input type="date" value={timeTo} onChange={(e) => setTimeTo(e.target.value)}
                className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:text-slate-100" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-0.5">Proyecto</label>
              <select value={timeProjectId} onChange={(e) => setTimeProjectId(e.target.value)}
                className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:text-slate-100">
                <option value="">Todos los proyectos</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={loadTimeReport} disabled={loadingTime}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
                {loadingTime ? 'Cargando…' : 'Generar reporte'}
              </button>
            </div>
          </div>

          {timeData && (
            <div className="space-y-4">
              {/* Totals by user */}
              {timeData.by_user.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Por usuario</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {timeData.by_user.map((u) => (
                      <div key={u.user_id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300 flex-shrink-0">
                          {(u.user_name?.[0] || '?').toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{u.user_name}</p>
                          <p className="text-xs text-slate-400">{u.entries} registro{u.entries !== 1 ? 's' : ''}</p>
                        </div>
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex-shrink-0">{parseFloat(u.total_hours).toFixed(1)}h</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detail table */}
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Detalle ({timeData.rows.length} registros)</p>
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-700/50">
                      <tr>
                        {['Fecha','Horas','Proyecto','Tarea','Usuario','Descripción'].map((h) => (
                          <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {timeData.rows.length === 0 ? (
                        <tr><td colSpan="6" className="text-center py-8 text-slate-400 text-sm">Sin registros en este período</td></tr>
                      ) : timeData.rows.map((r) => (
                        <tr key={r.id} className="border-t border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                          <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{r.work_date}</td>
                          <td className="px-3 py-2 font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{parseFloat(r.hours).toFixed(1)}h</td>
                          <td className="px-3 py-2 text-xs"><span className="font-mono text-slate-400">{r.project_code}</span> {r.project_name}</td>
                          <td className="px-3 py-2 text-xs max-w-[180px] truncate text-slate-700 dark:text-slate-300">{r.task_title}</td>
                          <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{r.user_name}</td>
                          <td className="px-3 py-2 text-xs text-slate-400 max-w-[150px] truncate">{r.description || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    {timeData.grand_total > 0 && (
                      <tfoot className="bg-slate-50 dark:bg-slate-700/50 border-t-2 border-slate-200 dark:border-slate-700">
                        <tr>
                          <td className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200">TOTAL</td>
                          <td className="px-3 py-2 font-bold text-emerald-600 dark:text-emerald-400">{parseFloat(timeData.grand_total).toFixed(1)}h</td>
                          <td colSpan="4" />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── SECCIÓN 1: Reporte por período ─────────────────────── */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5">
          {/* Period selector header */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-indigo-500" />
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Actividad por período</h2>
            </div>
            {range && (
              <span className="text-xs text-slate-400">
                {fmt(range.period.from)} — {fmt(range.period.to)}
              </span>
            )}
          </div>

          {/* Period buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            {PERIODS.map(({ key, label }) => (
              <button key={key} onClick={() => setPeriod(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  period === key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}>
                {label}
              </button>
            ))}
          </div>

          {/* Custom date picker */}
          {period === 'custom' && (
            <div className="flex flex-wrap items-end gap-3 mb-4 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Desde</label>
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                  className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:text-slate-100" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Hasta</label>
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                  className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:text-slate-100" />
              </div>
              <button onClick={() => loadRange('custom', customFrom, customTo)}
                disabled={!customFrom || !customTo || loadingRange}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
                {loadingRange ? 'Cargando...' : 'Consultar'}
              </button>
            </div>
          )}

          {/* Range KPIs */}
          {loadingRange ? (
            <div className="text-center py-8 text-slate-400 text-sm">Cargando período...</div>
          ) : range ? (
            <div className="space-y-4">
              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{tc.total ?? 0}</p>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">Tareas creadas</p>
                  {tc.completadas > 0 && <p className="text-xs text-indigo-400 mt-0.5">{tc.completadas} completadas</p>}
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{tco.total ?? 0}</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">Tareas completadas</p>
                  {tco.horas_registradas > 0 && <p className="text-xs text-emerald-400 mt-0.5">{parseFloat(tco.horas_registradas).toFixed(0)}h registradas</p>}
                </div>
                <div className="bg-violet-50 dark:bg-violet-900/20 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-violet-700 dark:text-violet-300">{parseFloat(hr.total_horas||0).toFixed(1)}</p>
                  <p className="text-xs text-violet-600 dark:text-violet-400 mt-0.5">Horas registradas</p>
                  {hr.usuarios_activos > 0 && <p className="text-xs text-violet-400 mt-0.5">{hr.usuarios_activos} colaboradores</p>}
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{pc.total ?? 0}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Proyectos nuevos</p>
                  {rc.total > 0 && <p className="text-xs text-blue-400 mt-0.5">{rc.total} riesgos · {ic.total} incidencias</p>}
                </div>
              </div>

              {/* Hours by user chart */}
              {hoursUserChart.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Horas por colaborador</p>
                  <ResponsiveContainer width="100%" height={Math.max(120, hoursUserChart.length * 36)}>
                    <BarChart data={hoursUserChart} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} unit="h" />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={110} />
                      <Tooltip formatter={(v) => `${v}h`} />
                      <Bar dataKey="horas" fill="#6366f1" radius={[0,4,4,0]} name="Horas" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Tasks by project table */}
              {range.tasks_by_project?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Tareas completadas por proyecto</p>
                  <div className="rounded-lg overflow-hidden border border-slate-100 dark:border-slate-700">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-900/40">
                        <tr>
                          <th className="text-left px-3 py-2 text-xs text-slate-500 font-semibold">Proyecto</th>
                          <th className="text-right px-3 py-2 text-xs text-slate-500 font-semibold">Completadas</th>
                          <th className="text-right px-3 py-2 text-xs text-slate-500 font-semibold">Horas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {range.tasks_by_project.map((row, i) => (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                            <td className="px-3 py-2">
                              <p className="font-medium text-slate-800 dark:text-slate-100 text-xs">{row.project}</p>
                              <p className="text-xs text-slate-400">{row.code}</p>
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-emerald-600">{row.completadas}</td>
                            <td className="px-3 py-2 text-right text-slate-500 text-xs">{parseFloat(row.horas).toFixed(1)}h</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Incidents/risks summary in range */}
              {(ic.total > 0 || rc.total > 0) && (
                <div className="flex gap-4 flex-wrap">
                  {rc.total > 0 && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <AlertTriangle size={14} className="text-amber-500" />
                      <span>{rc.total} riesgo{rc.total !== 1 ? 's' : ''} registrado{rc.total !== 1 ? 's' : ''}
                        {rc.criticos > 0 && <span className="text-red-500 ml-1">({rc.criticos} crítico{rc.criticos !== 1 ? 's' : ''})</span>}
                      </span>
                    </div>
                  )}
                  {ic.total > 0 && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <AlertTriangle size={14} className="text-red-500" />
                      <span>{ic.total} incidencia{ic.total !== 1 ? 's' : ''}, {ic.resueltas} resuelta{ic.resueltas !== 1 ? 's' : ''}
                        {ic.criticas > 0 && <span className="text-red-500 ml-1">({ic.criticas} crítica{ic.criticas !== 1 ? 's' : ''})</span>}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-slate-400 text-sm text-center py-8">Sin datos para el período seleccionado.</p>
          )}
        </div>

        {/* ── SECCIÓN 2: Resumen ejecutivo (global) ──────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Resumen ejecutivo</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Métricas globales de la organización</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 print:hidden">
            <button onClick={exportCSV}
              className="flex items-center gap-2 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium px-3 py-2 rounded-lg transition-colors">
              <Download size={14} /> CSV
            </button>
            <button onClick={exportPDF}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
              <Download size={14} /> Exportar PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Proyectos"     value={p.total}          icon={FolderKanban}  color="bg-indigo-500" />
          <StatCard label="En Ejecución"         value={p.en_ejecucion}   icon={TrendingUp}    color="bg-blue-500" />
          <StatCard label="Proyectos Vencidos"   value={p.vencidos}       icon={AlertTriangle} color="bg-red-500" />
          <StatCard label="Avance Promedio"      value={`${p.avance_promedio ?? 0}%`} icon={CheckCircle2} color="bg-emerald-500" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Tareas Totales"      value={t.total}         icon={Flag}          color="bg-slate-500" />
          <StatCard label="Tareas Completadas"  value={t.completadas}   icon={CheckCircle2}  color="bg-emerald-500" sub={`${taskCompletion}% completado`} />
          <StatCard label="Tareas Bloqueadas"   value={t.bloqueadas}    icon={AlertTriangle} color="bg-red-400" />
          <StatCard label="Horas Registradas"   value={`${parseFloat(t.horas_registradas||0).toFixed(0)}h`} icon={Clock} color="bg-purple-500"
            sub={t.horas_estimadas > 0 ? `${Math.round(t.horas_registradas/t.horas_estimadas*100)}% del plan` : undefined} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Presupuesto Total"    value={`$${Number(p.presupuesto_total||0).toLocaleString()}`}    icon={DollarSign} color="bg-slate-500" />
          <StatCard label="Presupuesto Ejecutado" value={`$${Number(p.presupuesto_ejecutado||0).toLocaleString()}`} icon={DollarSign} color="bg-blue-400" sub={`${budgetUsed}% del plan`} />
          <StatCard label="Hitos Completados"    value={m.completados}   icon={Flag}          color="bg-emerald-400" sub={m.total > 0 ? `${Math.round(m.completados/m.total*100)}% del total` : undefined} />
          <StatCard label="Riesgos Críticos"     value={r.criticos}      icon={AlertTriangle} color="bg-amber-500" />
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Proyectos por Estado</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byStatusChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[4,4,0,0]}>
                  {byStatusChart.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Proyectos por Categoría</h3>
            {byCategoryChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={byCategoryChart} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={70}
                    label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                    {byCategoryChart.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-slate-400 text-sm text-center py-8">Sin datos</p>}
          </div>
        </div>

        {hoursChart.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Horas por Proyecto (estimadas vs registradas)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hoursChart} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 10 }} unit="h" />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} />
                <Tooltip formatter={(v) => `${v}h`} />
                <Bar dataKey="estimadas"   fill="#e2e8f0" radius={[0,4,4,0]} name="Estimadas" />
                <Bar dataKey="registradas" fill="#6366f1" radius={[0,4,4,0]} name="Registradas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-500" /> Riesgos
            </h3>
            <div className="space-y-2">
              {[['Total', r.total, ''], ['Críticos activos', r.criticos, 'text-red-600'], ['Activos', r.activos, 'text-amber-600'], ['Mitigados', r.mitigados, 'text-emerald-600']].map(([l, v, c]) => (
                <div key={l} className="flex justify-between text-sm"><span className="text-slate-500">{l}</span><span className={`font-semibold ${c}`}>{v ?? 0}</span></div>
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <AlertTriangle size={15} className="text-red-500" /> Incidencias
            </h3>
            <div className="space-y-2">
              {[['Total', inc.total, ''], ['Críticas', inc.criticas, 'text-red-600'], ['Abiertas', inc.abiertas, 'text-amber-600']].map(([l, v, c]) => (
                <div key={l} className="flex justify-between text-sm"><span className="text-slate-500">{l}</span><span className={`font-semibold ${c}`}>{v ?? 0}</span></div>
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <Flag size={15} className="text-indigo-500" /> Hitos
            </h3>
            <div className="space-y-2">
              {[['Total', m.total, ''], ['Completados', m.completados, 'text-emerald-600'], ['Vencidos', m.vencidos, 'text-red-600']].map(([l, v, c]) => (
                <div key={l} className="flex justify-between text-sm"><span className="text-slate-500">{l}</span><span className={`font-semibold ${c}`}>{v ?? 0}</span></div>
              ))}
            </div>
            {m.total > 0 && (
              <div className="mt-3">
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.round(m.completados/m.total*100)}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top projects */}
        {overview?.top_projects?.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Top Proyectos por Avance</h3>
            <div className="space-y-3">
              {overview.top_projects.map((proj) => (
                <Link key={proj.id} to={`/projects/${proj.id}`}
                  className="flex items-center gap-4 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: proj.category_color || '#6366f1' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{proj.name}</p>
                    <p className="text-xs text-slate-400">{proj.code} · {STATUS_LABELS[proj.status] || proj.status}</p>
                  </div>
                  <div className="w-32 flex-shrink-0">
                    <div className="flex justify-end text-xs text-slate-700 dark:text-slate-300 mb-1 font-medium">{proj.completion_percentage}%</div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${proj.completion_percentage}%` }} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
