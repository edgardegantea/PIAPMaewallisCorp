import { useEffect, useState } from 'react';
import { projectsAPI } from '../services/projectsAPI';
import Layout from '../components/Layout';
import { toast } from 'sonner';
import { Lock, Plus, Trash2, Edit2, Check, X, Loader2 } from 'lucide-react';

const PERM_GROUPS = {
  'Proyectos': ['projects.view','projects.edit','projects.delete'],
  'Tareas':    ['tasks.view','tasks.create','tasks.edit','tasks.delete'],
  'Sprints':   ['sprints.manage','backlog.manage'],
  'Equipo':    ['members.manage'],
  'Módulos':   ['risks.manage','incidents.manage','milestones.manage','documents.manage','technicaldocs.manage'],
  'Finanzas':  ['budget.view','budget.edit'],
  'Admin':     ['reports.view','audit.view','webhooks.manage'],
};

export default function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name:'', description:'', permissions:[] });

  const load = () => projectsAPI.getRoles().then(r=>setRoles(r.data)).catch(()=>{}).finally(()=>setLoading(false));
  useEffect(()=>{ load(); },[]);

  const togglePerm = (perm) => setForm(f=>({ ...f, permissions: f.permissions.includes(perm) ? f.permissions.filter(p=>p!==perm) : [...f.permissions,perm] }));

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editId) { await projectsAPI.updateRole(editId, form); toast.success('Rol actualizado'); }
      else        { await projectsAPI.createRole(form); toast.success('Rol creado'); }
      setShowForm(false); setEditId(null); setForm({name:'',description:'',permissions:[]}); load();
    } catch { toast.error('Error al guardar rol'); }
  };

  const startEdit = (r) => { setEditId(r.id); setForm({name:r.name,description:r.description||'',permissions:r.permissions||[]}); setShowForm(true); };
  const del = async (id) => { await projectsAPI.deleteRole(id); load(); };

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lock size={20} className="text-indigo-500"/>
            <div><h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Roles personalizados</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Define permisos granulares por módulo</p></div>
          </div>
          <button onClick={()=>{setShowForm(v=>!v);setEditId(null);setForm({name:'',description:'',permissions:[]});}} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"><Plus size={14}/> Nuevo rol</button>
        </div>

        {showForm && (
          <form onSubmit={save} className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200">{editId?'Editar':'Crear'} rol</h3>
            <div className="grid grid-cols-2 gap-3">
              <input required value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Nombre del rol *" className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
              <input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Descripción" className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Permisos</p>
              {Object.entries(PERM_GROUPS).map(([group, perms]) => (
                <div key={group}>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">{group}</p>
                  <div className="flex flex-wrap gap-2">
                    {perms.map(p => (
                      <button key={p} type="button" onClick={()=>togglePerm(p)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${form.permissions.includes(p)?'bg-indigo-600 text-white border-indigo-600':'border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-indigo-400'}`}>
                        {p.split('.')[1]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={()=>{setShowForm(false);setEditId(null);}} className="text-sm text-slate-500 px-3 py-2">Cancelar</button>
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg">Guardar</button>
            </div>
          </form>
        )}

        {loading ? <div className="text-center py-20 text-slate-400">Cargando…</div> : roles.length === 0 ? (
          <div className="text-center py-20 text-slate-400"><Lock size={40} className="mx-auto mb-3 opacity-30"/><p>Sin roles personalizados.</p></div>
        ) : (
          <div className="space-y-3">
            {roles.map(r=>(
              <div key={r.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{r.name}</p>
                    {r.description&&<p className="text-xs text-slate-500 mt-0.5">{r.description}</p>}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(r.permissions||[]).map(p=><span key={p} className="text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded">{p}</span>)}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={()=>startEdit(r)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><Edit2 size={13}/></button>
                    <button onClick={()=>del(r.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 size={13}/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
