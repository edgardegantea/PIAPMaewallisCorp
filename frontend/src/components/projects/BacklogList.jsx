import { useEffect, useState } from 'react';
import { projectsAPI } from '../../services/projectsAPI';
import { toast } from 'sonner';
import { Plus, Trash2, ArrowRight, Edit2, X, Check, Bookmark, BookmarkCheck, ChevronDown } from 'lucide-react';
import ConfirmModal from '../ConfirmModal';

const PRIORITY_COLORS = {
  BAJA:  'bg-green-100 text-green-700',
  MEDIA: 'bg-blue-100 text-blue-700',
  ALTA:  'bg-amber-100 text-amber-700',
};
const STATUS_COLORS = {
  BACKLOG:    'bg-slate-100 text-slate-600',
  EN_SPRINT:  'bg-blue-100 text-blue-700',
  COMPLETADA: 'bg-emerald-100 text-emerald-700',
};

const EMPTY = {
  project_id: '', title: '', description: '', acceptance_criteria: '',
  priority: 'MEDIA', story_points: 0,
  user_role: '', user_action: '', user_benefit: '',
  epic_id: '',
};

export default function BacklogList({ projectId, isManager = false }) {
  const [items, setItems]         = useState([]);
  const [sprints, setSprints]     = useState([]);
  const [epics, setEpics]         = useState([]);
  const [form, setForm]           = useState({ ...EMPTY, project_id: projectId });
  const [showForm, setShowForm]   = useState(false);
  const [loading, setLoading]     = useState(true);
  const [confirm, setConfirm]     = useState(null);
  const [assignTarget, setAssign] = useState({});
  const [editId, setEditId]       = useState(null);
  const [editForm, setEditForm]   = useState({});

  // Filters
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStatus, setFilterStatus]     = useState('');
  const [savedFilters, setSavedFilters]     = useState([]);
  const [showSaveFilter, setShowSaveFilter] = useState(false);
  const [filterName, setFilterName]         = useState('');

  const load = () => {
    Promise.all([
      projectsAPI.getBacklogItems(projectId),
      projectsAPI.getSprints(projectId),
      projectsAPI.getEpics(projectId),
    ]).then(([bi, sp, ep]) => {
      setItems(bi.data);
      setSprints(sp.data);
      setEpics(ep.data);
    }).finally(() => setLoading(false));
  };

  const loadSavedFilters = () => {
    projectsAPI.getSavedFilters({ project_id: projectId })
      .then(r => setSavedFilters(r.data ?? []))
      .catch(() => {});
  };

  useEffect(() => { load(); loadSavedFilters(); }, [projectId]);

  const saveFilter = async () => {
    if (!filterName.trim()) { toast.error('Dale un nombre al filtro'); return; }
    try {
      await projectsAPI.createSavedFilter({ project_id: projectId, name: filterName, filters: { priority: filterPriority, status: filterStatus } });
      toast.success('Filtro guardado');
      setFilterName('');
      setShowSaveFilter(false);
      loadSavedFilters();
    } catch { toast.error('Error al guardar filtro'); }
  };

  const applyFilter = (f) => {
    const filters = f.filters ?? {};
    setFilterPriority(filters.priority ?? '');
    setFilterStatus(filters.status ?? '');
    toast.success(`Filtro "${f.name}" aplicado`);
  };

  const deleteFilter = async (id) => {
    try {
      await projectsAPI.deleteSavedFilter(id);
      setSavedFilters(prev => prev.filter(f => f.id !== id));
    } catch { toast.error('Error al eliminar filtro'); }
  };

  // Auto-fill title from user story fields
  const buildTitle = (role, action, benefit) => {
    if (!role && !action && !benefit) return '';
    const parts = [];
    if (role)    parts.push(`Como ${role}`);
    if (action)  parts.push(`quiero ${action}`);
    if (benefit) parts.push(`para ${benefit}`);
    return parts.join(', ');
  };

  const handleStoryField = (field, value, currentForm, setter) => {
    const updated = { ...currentForm, [field]: value };
    // Sync title only if title is empty or matches previous story pattern
    const autoTitle = buildTitle(
      field === 'user_role'    ? value : currentForm.user_role,
      field === 'user_action'  ? value : currentForm.user_action,
      field === 'user_benefit' ? value : currentForm.user_benefit,
    );
    setter({ ...updated, title: autoTitle || updated.title });
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, epic_id: form.epic_id || null };
      await projectsAPI.createBacklogItem(payload);
      toast.success('Historia creada');
      setForm({ ...EMPTY, project_id: projectId });
      setShowForm(false);
      load();
    } catch { toast.error('Error al crear historia'); }
  };

  const remove = (id) => setConfirm({
    title: 'Eliminar historia',
    body: '¿Eliminar esta historia del backlog?',
    onConfirm: async () => {
      try { await projectsAPI.deleteBacklogItem(id); load(); }
      catch { toast.error('Error al eliminar'); }
    },
  });

  const changeStatus = async (id, status) => {
    try { await projectsAPI.updateBacklogItem(id, { status }); load(); }
    catch { toast.error('Error'); }
  };

  const assignToSprint = async (itemId) => {
    const sprintId = assignTarget[itemId];
    if (!sprintId) return;
    try {
      await projectsAPI.updateBacklogItem(itemId, { sprint_id: sprintId, status: 'EN_SPRINT' });
      toast.success('Historia asignada al sprint');
      load();
    } catch { toast.error('Error al asignar'); }
  };

  const startEdit = (item) => {
    setEditId(item.id);
    setEditForm({
      title: item.title, description: item.description || '',
      acceptance_criteria: item.acceptance_criteria || '',
      priority: item.priority, story_points: item.story_points || 0,
      user_role: item.user_role || '', user_action: item.user_action || '',
      user_benefit: item.user_benefit || '', epic_id: item.epic_id || '',
    });
  };

  const saveEdit = async () => {
    try {
      await projectsAPI.updateBacklogItem(editId, { ...editForm, epic_id: editForm.epic_id || null });
      toast.success('Historia actualizada');
      setEditId(null);
      load();
    } catch { toast.error('Error al actualizar'); }
  };

  const counts = items.reduce((acc, i) => { acc[i.status] = (acc[i.status] || 0) + 1; return acc; }, {});
  const totalPoints = items.reduce((s, i) => s + (parseInt(i.story_points) || 0), 0);

  const displayedItems = items.filter(i => {
    if (filterPriority && i.priority !== filterPriority) return false;
    if (filterStatus   && i.status   !== filterStatus)   return false;
    return true;
  });

  const hasActiveFilter = filterPriority || filterStatus;

  if (loading) return <p className="text-slate-400 text-sm">Cargando...</p>;

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-700">Product Backlog ({items.length})</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {counts.BACKLOG || 0} en backlog · {counts.EN_SPRINT || 0} en sprint · {counts.COMPLETADA || 0} completadas · {totalPoints} pts
          </p>
        </div>
        {isManager && (
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg">
            <Plus size={14} /> Nueva Historia
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
          className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400">
          <option value="">Todas las prioridades</option>
          <option value="BAJA">Baja</option>
          <option value="MEDIA">Media</option>
          <option value="ALTA">Alta</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400">
          <option value="">Todos los estados</option>
          <option value="BACKLOG">Backlog</option>
          <option value="EN_SPRINT">En Sprint</option>
          <option value="COMPLETADA">Completada</option>
        </select>
        {hasActiveFilter && (
          <button onClick={() => { setFilterPriority(''); setFilterStatus(''); }}
            className="text-xs text-red-500 hover:underline flex items-center gap-1">
            <X size={11} /> Limpiar
          </button>
        )}
        {/* Saved filters dropdown */}
        {savedFilters.length > 0 && (
          <div className="relative group">
            <button className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg px-2.5 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors">
              <BookmarkCheck size={11} /> Filtros guardados <ChevronDown size={11} />
            </button>
            <div className="absolute left-0 top-full mt-1 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg min-w-[180px] hidden group-hover:block">
              {savedFilters.map(f => (
                <div key={f.id} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <button onClick={() => applyFilter(f)} className="text-xs text-slate-700 dark:text-slate-200 truncate text-left">{f.name}</button>
                  <button onClick={() => deleteFilter(f.id)} className="text-slate-300 hover:text-red-500 flex-shrink-0 ml-2"><X size={11} /></button>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Save current filter */}
        {hasActiveFilter && !showSaveFilter && (
          <button onClick={() => setShowSaveFilter(true)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 transition-colors">
            <Bookmark size={11} /> Guardar filtro
          </button>
        )}
        {showSaveFilter && (
          <div className="flex items-center gap-1">
            <input autoFocus type="text" value={filterName} onChange={e => setFilterName(e.target.value)}
              placeholder="Nombre del filtro" onKeyDown={e => e.key === 'Enter' && saveFilter()}
              className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 w-36 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <button onClick={saveFilter} className="text-emerald-600 hover:text-emerald-700"><Check size={14} /></button>
            <button onClick={() => setShowSaveFilter(false)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
          </div>
        )}
      </div>

      {/* Create form */}
      {showForm && isManager && (
        <form onSubmit={submit} className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 space-y-3">
          {/* User Story format */}
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Formato Historia de Usuario</p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Como (rol)</label>
              <input value={form.user_role}
                onChange={(e) => handleStoryField('user_role', e.target.value, form, setForm)}
                placeholder="usuario / admin..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Quiero (acción)</label>
              <input value={form.user_action}
                onChange={(e) => handleStoryField('user_action', e.target.value, form, setForm)}
                placeholder="poder ver..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Para (beneficio)</label>
              <input value={form.user_benefit}
                onChange={(e) => handleStoryField('user_benefit', e.target.value, form, setForm)}
                placeholder="mejorar mi flujo..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Título *</label>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Como [rol], quiero [acción] para [beneficio]"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Prioridad</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="BAJA">Baja</option>
                <option value="MEDIA">Media</option>
                <option value="ALTA">Alta</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Story Points</label>
              <input type="number" min="0" max="100" value={form.story_points}
                onChange={(e) => setForm({ ...form, story_points: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Épica</label>
              <select value={form.epic_id} onChange={(e) => setForm({ ...form, epic_id: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="">Sin épica</option>
                {epics.map((ep) => (
                  <option key={ep.id} value={ep.id}>{ep.title}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Criterios de Aceptación</label>
            <textarea rows={2} value={form.acceptance_criteria} onChange={(e) => setForm({ ...form, acceptance_criteria: e.target.value })}
              placeholder="Dado que... Cuando... Entonces..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-slate-500 px-3 py-2">Cancelar</button>
            <button type="submit" className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg">Crear</button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-8">Backlog vacío — agrega historias de usuario</p>
      ) : displayedItems.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-6">Sin resultados con los filtros aplicados</p>
      ) : (
        <div className="space-y-2">
          {displayedItems.map((item) => {
            const epic = epics.find((e) => String(e.id) === String(item.epic_id));
            const isEdit = editId === item.id;

            return (
              <div key={item.id}
                className={`border rounded-xl p-4 transition-colors
                  ${item.status === 'COMPLETADA' ? 'bg-emerald-50 border-emerald-200 opacity-70' : 'border-slate-200 hover:bg-slate-50'}`}>

                {isEdit ? (
                  /* ── Inline edit ───────────────────────── */
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Rol</label>
                        <input value={editForm.user_role}
                          onChange={(e) => setEditForm({ ...editForm, user_role: e.target.value })}
                          className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Acción</label>
                        <input value={editForm.user_action}
                          onChange={(e) => setEditForm({ ...editForm, user_action: e.target.value })}
                          className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Beneficio</label>
                        <input value={editForm.user_benefit}
                          onChange={(e) => setEditForm({ ...editForm, user_benefit: e.target.value })}
                          className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none" />
                      </div>
                    </div>
                    <input value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <div className="grid grid-cols-3 gap-2">
                      <select value={editForm.priority}
                        onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                        className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none">
                        <option value="BAJA">Baja</option>
                        <option value="MEDIA">Media</option>
                        <option value="ALTA">Alta</option>
                      </select>
                      <input type="number" min="0" value={editForm.story_points}
                        onChange={(e) => setEditForm({ ...editForm, story_points: e.target.value })}
                        placeholder="Pts"
                        className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none" />
                      <select value={editForm.epic_id || ''}
                        onChange={(e) => setEditForm({ ...editForm, epic_id: e.target.value })}
                        className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none">
                        <option value="">Sin épica</option>
                        {epics.map((ep) => <option key={ep.id} value={ep.id}>{ep.title}</option>)}
                      </select>
                    </div>
                    <textarea rows={2} value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      placeholder="Descripción..."
                      className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs focus:outline-none resize-none" />
                    <textarea rows={2} value={editForm.acceptance_criteria}
                      onChange={(e) => setEditForm({ ...editForm, acceptance_criteria: e.target.value })}
                      placeholder="Criterios de aceptación..."
                      className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs focus:outline-none resize-none" />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditId(null)} className="text-slate-400 hover:text-slate-600 p-1"><X size={14} /></button>
                      <button onClick={saveEdit} className="bg-indigo-600 text-white text-xs px-3 py-1 rounded-lg flex items-center gap-1">
                        <Check size={12} /> Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Read view ─────────────────────────── */
                  <>
                    <div className="flex items-start gap-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${PRIORITY_COLORS[item.priority]}`}>
                        {item.priority}
                      </span>
                      <div className="flex-1 min-w-0">
                        {/* Epic chip */}
                        {epic && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded mb-1"
                            style={{ backgroundColor: epic.color + '22', color: epic.color }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: epic.color }} />
                            {epic.title}
                          </span>
                        )}
                        <p className={`text-sm font-medium ${item.status === 'COMPLETADA' ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                          {item.title}
                        </p>
                        {/* User story breakdown */}
                        {(item.user_role || item.user_action || item.user_benefit) && (
                          <p className="text-xs text-slate-400 mt-0.5 italic">
                            {[item.user_role && `Como ${item.user_role}`,
                              item.user_action && `quiero ${item.user_action}`,
                              item.user_benefit && `para ${item.user_benefit}`]
                              .filter(Boolean).join(', ')}
                          </p>
                        )}
                        {item.description && (
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{item.description}</p>
                        )}
                        {item.acceptance_criteria && (
                          <p className="text-xs text-slate-400 mt-1 italic line-clamp-1">
                            ✓ {item.acceptance_criteria}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          {item.story_points || 0}p
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[item.status]}`}>
                          {item.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-100">
                      <select value={item.status}
                        onChange={(e) => changeStatus(item.id, e.target.value)}
                        className="text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400">
                        <option value="BACKLOG">Backlog</option>
                        <option value="EN_SPRINT">En Sprint</option>
                        <option value="COMPLETADA">Completada</option>
                      </select>

                      {sprints.length > 0 && item.status !== 'COMPLETADA' && isManager && (
                        <div className="flex items-center gap-1 ml-2">
                          <select value={assignTarget[item.id] || ''}
                            onChange={(e) => setAssign({ ...assignTarget, [item.id]: e.target.value })}
                            className="text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400">
                            <option value="">→ Asignar sprint</option>
                            {sprints.map((s) => (
                              <option key={s.id} value={s.id}>Sprint {s.number}: {s.name}</option>
                            ))}
                          </select>
                          {assignTarget[item.id] && (
                            <button onClick={() => assignToSprint(item.id)}
                              className="text-xs bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-2 py-1 rounded flex items-center gap-1 transition-colors">
                              <ArrowRight size={11} /> Asignar
                            </button>
                          )}
                        </div>
                      )}

                      <div className="ml-auto flex gap-1">
                        {isManager && (
                          <button onClick={() => startEdit(item)}
                            className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 transition-colors">
                            <Edit2 size={13} />
                          </button>
                        )}
                        {isManager && (
                          <button onClick={() => remove(item.id)}
                            className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {confirm && <ConfirmModal {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}
