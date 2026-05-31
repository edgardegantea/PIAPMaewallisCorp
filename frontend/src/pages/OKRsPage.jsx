import { useEffect, useState } from 'react';
import { projectsAPI } from '../services/projectsAPI';
import Layout from '../components/Layout';
import { toast } from 'sonner';
import { Target, Plus, Trash2, Edit2, ChevronDown, ChevronUp, X, Check, Loader2 } from 'lucide-react';

const STATUS_COLORS = { ON_TRACK:'bg-emerald-100 text-emerald-700', AT_RISK:'bg-amber-100 text-amber-700', OFF_TRACK:'bg-red-100 text-red-700', COMPLETED:'bg-blue-100 text-blue-700' };
const STATUS_LABELS = { ON_TRACK:'En curso', AT_RISK:'En riesgo', OFF_TRACK:'Desviado', COMPLETED:'Completado' };

function KRRow({ kr, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(kr.current_value);
  const pct = kr.target_value > 0 ? Math.min(100, Math.round((kr.current_value / kr.target_value) * 100)) : 0;
  const save = async () => {
    await onUpdate(kr.id, { current_value: val });
    setEditing(false);
  };
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700 dark:text-slate-200">{kr.title}</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-600 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${pct>=100?'bg-emerald-500':pct>=60?'bg-indigo-500':'bg-amber-400'}`} style={{width:`${pct}%`}}/>
          </div>
          <span className="text-xs text-slate-500 w-8">{pct}%</span>
        </div>
      </div>
      {editing ? (
        <div className="flex items-center gap-1">
          <input type="number" value={val} onChange={e=>setVal(e.target.value)} className="w-20 border border-slate-300 rounded px-2 py-0.5 text-xs" />
          <span className="text-xs text-slate-400">/ {kr.target_value} {kr.unit}</span>
          <button onClick={save} className="text-emerald-600"><Check size={13}/></button>
          <button onClick={()=>setEditing(false)} className="text-slate-400"><X size={13}/></button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>{kr.current_value} / {kr.target_value} {kr.unit}</span>
          <button onClick={()=>setEditing(true)} className="hover:text-indigo-600"><Edit2 size={11}/></button>
          <button onClick={()=>onDelete(kr.id)} className="hover:text-red-500"><Trash2 size={11}/></button>
        </div>
      )}
    </div>
  );
}

export default function OKRsPage() {
  const [objectives, setObjectives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title:'', description:'', period:'', status:'ON_TRACK' });
  const [expanded, setExpanded] = useState({});
  const [newKR, setNewKR] = useState({});

  const load = () => projectsAPI.getOKRs({}).then(r => setObjectives(r.data)).catch(()=>{}).finally(()=>setLoading(false));
  useEffect(() => { load(); }, []);

  const createOKR = async (e) => {
    e.preventDefault();
    try { await projectsAPI.createOKR(form); toast.success('Objetivo creado'); setForm({title:'',description:'',period:'',status:'ON_TRACK'}); setShowForm(false); load(); }
    catch { toast.error('Error al crear objetivo'); }
  };
  const deleteOKR = async (id) => { await projectsAPI.deleteOKR(id); load(); };
  const addKR = async (objId) => {
    const t = newKR[objId]?.title; if (!t) return;
    await projectsAPI.createKR(objId, { title:t, target_value:newKR[objId]?.target_value||100, unit:newKR[objId]?.unit||'%' });
    setNewKR(p=>({...p,[objId]:{}})); load();
  };
  const updateKR = async (id, data) => { await projectsAPI.updateKR(id, data); load(); };
  const deleteKR = async (id) => { await projectsAPI.deleteKR(id); load(); };

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Target size={20} className="text-indigo-500"/>
            <div><h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">OKRs</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Objetivos y Resultados Clave</p></div>
          </div>
          <button onClick={()=>setShowForm(v=>!v)} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus size={14}/> Nuevo objetivo
          </button>
        </div>

        {showForm && (
          <form onSubmit={createOKR} className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <input required value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Objetivo *" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
            <div className="grid grid-cols-2 gap-3">
              <input value={form.period} onChange={e=>setForm(f=>({...f,period:e.target.value}))} placeholder="Período (ej. Q2-2026)" className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
              <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100">
                {Object.entries(STATUS_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={()=>setShowForm(false)} className="text-sm text-slate-500 px-3 py-2">Cancelar</button>
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg">Guardar</button>
            </div>
          </form>
        )}

        {loading ? <div className="text-center py-20 text-slate-400">Cargando…</div> : objectives.length === 0 ? (
          <div className="text-center py-20 text-slate-400"><Target size={40} className="mx-auto mb-3 opacity-30"/><p>Sin OKRs definidos aún.</p></div>
        ) : (
          <div className="space-y-3">
            {objectives.map(obj => (
              <div key={obj.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-800 dark:text-slate-100">{obj.title}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[obj.status]}`}>{STATUS_LABELS[obj.status]}</span>
                        {obj.period && <span className="text-xs text-slate-400">{obj.period}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${obj.progress>=100?'bg-emerald-500':obj.progress>=60?'bg-indigo-500':'bg-amber-400'}`} style={{width:`${obj.progress}%`}}/>
                        </div>
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 w-8">{obj.progress}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={()=>setExpanded(p=>({...p,[obj.id]:!p[obj.id]}))} className="text-slate-400 hover:text-slate-600 p-1.5 rounded">
                        {expanded[obj.id]?<ChevronUp size={14}/>:<ChevronDown size={14}/>}
                      </button>
                      <button onClick={()=>deleteOKR(obj.id)} className="text-slate-300 hover:text-red-500 p-1.5 rounded"><Trash2 size={13}/></button>
                    </div>
                  </div>
                </div>
                {expanded[obj.id] && (
                  <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700 pt-3 space-y-1">
                    {(obj.key_results||[]).map(kr=><KRRow key={kr.id} kr={kr} onUpdate={updateKR} onDelete={deleteKR}/>)}
                    <div className="flex gap-2 mt-2">
                      <input value={newKR[obj.id]?.title||''} onChange={e=>setNewKR(p=>({...p,[obj.id]:{...p[obj.id],title:e.target.value}}))} placeholder="Nuevo resultado clave…" className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                      <input type="number" value={newKR[obj.id]?.target_value||''} onChange={e=>setNewKR(p=>({...p,[obj.id]:{...p[obj.id],target_value:e.target.value}}))} placeholder="Meta" className="w-16 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-700 dark:text-slate-100"/>
                      <input value={newKR[obj.id]?.unit||'%'} onChange={e=>setNewKR(p=>({...p,[obj.id]:{...p[obj.id],unit:e.target.value}}))} placeholder="%" className="w-12 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-700 dark:text-slate-100"/>
                      <button onClick={()=>addKR(obj.id)} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1"><Plus size={11}/>Agregar</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
