import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectsAPI } from '../services/projectsAPI';
import Layout from '../components/Layout';
import { BarChart2, ChevronRight, AlertTriangle, CheckCircle2, Clock, AlertOctagon } from 'lucide-react';

const STATUS_DOT = { PLANIFICACION:'bg-blue-400',EJECUCION:'bg-indigo-500',SEGUIMIENTO:'bg-amber-400',CIERRE:'bg-purple-400',COMPLETADO:'bg-emerald-500',CANCELADO:'bg-slate-400' };
const RAG_CLS    = { RED:'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400', AMBER:'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400', GREEN:'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400' };
const RAG_LBL    = { RED:'En riesgo', AMBER:'Atención', GREEN:'En curso' };

export default function PortfolioPage() {
  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [sort,     setSort]     = useState('rag');
  const [ragFilter,setRagFilter]= useState('');
  const navigate = useNavigate();

  useEffect(() => {
    projectsAPI.getPortfolio().then(r => setProjects(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const rows = projects
    .filter(p => !ragFilter || p.rag === ragFilter)
    .sort((a,b) => sort==='rag' ? ['RED','AMBER','GREEN'].indexOf(a.rag)-['RED','AMBER','GREEN'].indexOf(b.rag) : sort==='pct' ? (b.completion_pct||0)-(a.completion_pct||0) : a.name.localeCompare(b.name));

  const t = { total:projects.length, red:projects.filter(p=>p.rag==='RED').length, amber:projects.filter(p=>p.rag==='AMBER').length, overdue:projects.reduce((s,p)=>s+(+p.tasks_overdue||0),0) };

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <BarChart2 size={20} className="text-indigo-500"/>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Portfolio de Proyectos</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Vista ejecutiva RAG cross-proyectos</p>
            </div>
          </div>
          <div className="flex gap-2">
            <select value={sort} onChange={e=>setSort(e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100">
              <option value="rag">Semáforo</option><option value="name">Nombre</option><option value="pct">Avance</option>
            </select>
            <select value={ragFilter} onChange={e=>setRagFilter(e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100">
              <option value="">Todos</option><option value="RED">🔴 Riesgo</option><option value="AMBER">🟡 Atención</option><option value="GREEN">🟢 OK</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[{icon:BarChart2,label:'Total',value:t.total,c:'text-indigo-500'},{icon:AlertOctagon,label:'En riesgo',value:t.red,c:'text-red-500'},{icon:Clock,label:'Atención',value:t.amber,c:'text-amber-500'},{icon:AlertTriangle,label:'Vencidas',value:t.overdue,c:'text-rose-500'}].map(({icon:I,label,value,c})=>(
            <div key={label} className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center"><I size={18} className={c}/></div>
              <div><p className="text-xl font-bold text-slate-800 dark:text-slate-100">{value}</p><p className="text-xs text-slate-500">{label}</p></div>
            </div>
          ))}
        </div>

        {loading ? <div className="text-center py-20 text-slate-400">Cargando…</div> : (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                  <tr>{['Proyecto','RAG','Avance','Tareas','Riesgos','Presupuesto','Días',''].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map(p=>(
                    <tr key={p.id} onClick={()=>navigate(`/projects/${p.id}`)} className="border-b border-slate-100 dark:border-slate-700/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[p.status]||'bg-slate-400'}`}/>
                          <div><p className="font-semibold text-slate-800 dark:text-slate-100">{p.name}</p><p className="text-[10px] text-slate-400">{p.code} · {p.director_name}</p></div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${RAG_CLS[p.rag]}`}>{RAG_LBL[p.rag]}</span></td>
                      <td className="px-4 py-3 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-600 rounded-full overflow-hidden"><div className={`h-full rounded-full ${p.completion_pct>=80?'bg-emerald-500':p.completion_pct>=40?'bg-indigo-500':'bg-slate-300'}`} style={{width:`${p.completion_pct}%`}}/></div>
                          <span className="text-xs text-slate-500 w-8">{p.completion_pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className="font-medium text-slate-700 dark:text-slate-200">{p.tasks_done}/{p.tasks_total}</span>
                        {+p.tasks_overdue>0&&<span className="ml-1 text-red-500">+{p.tasks_overdue}v</span>}
                        {+p.tasks_blocked>0&&<span className="ml-1 text-amber-500">{p.tasks_blocked}b</span>}
                      </td>
                      <td className="px-4 py-3">{+p.critical_risks>0?<span className="flex items-center gap-1 text-red-500 text-xs font-semibold"><AlertTriangle size={11}/>{p.critical_risks}</span>:<span className="text-slate-300 text-xs">—</span>}</td>
                      <td className="px-4 py-3">{p.budget_pct!=null?<span className={`text-xs font-medium ${p.budget_pct>100?'text-red-500':p.budget_pct>80?'text-amber-500':'text-slate-500'}`}>{p.budget_pct}%</span>:<span className="text-slate-300 text-xs">—</span>}</td>
                      <td className="px-4 py-3">{p.days_left!=null?<span className={`text-xs font-medium ${p.days_left<0?'text-red-500':p.days_left<14?'text-amber-500':'text-slate-500'}`}>{p.days_left<0?`${-p.days_left}d venc.`:`${p.days_left}d`}</span>:<span className="text-slate-300 text-xs">—</span>}</td>
                      <td className="px-4 py-3"><ChevronRight size={14} className="text-slate-400"/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
