import { useEffect, useRef, useState } from 'react';
import { projectsAPI } from '../../services/projectsAPI';
import { useAuthStore } from '../../stores/authStore';
import { toast } from 'sonner';
import {
  Plus, Trash2, Edit2, X, Check, ExternalLink, Tag,
  FileText, FileSpreadsheet, Presentation, Image, Archive,
  Upload, Download, File, Loader2, Link, Eye,
  CheckCircle2, Clock, AlertCircle, ChevronUp, ChevronDown,
  Search, SortAsc, SortDesc, PenLine, ShieldCheck,
} from 'lucide-react';
import ConfirmModal  from '../ConfirmModal';
import DocPreviewModal   from './DocPreviewModal';
import DocVersionHistory from './DocVersionHistory';
import DocComments       from './DocComments';

/* ── constants ─────────────────────────────────────────────────────────── */

const STATUS_COLORS = {
  BORRADOR:    'bg-slate-100  text-slate-600  dark:bg-slate-700  dark:text-slate-400',
  EN_REVISION: 'bg-amber-100  text-amber-700  dark:bg-amber-900/30 dark:text-amber-400',
  APROBADO:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  OBSOLETO:    'bg-red-100    text-red-600    dark:bg-red-900/30  dark:text-red-400',
};

const DOC_TYPES = [
  'REQUERIMIENTOS','ARQUITECTURA','DISEÑO','API',
  'BASE_DATOS','MANUAL_USUARIO','MANUAL_TECNICO','PRUEBAS','DESPLIEGUE','OTRO',
];
const STATUSES = ['BORRADOR','EN_REVISION','APROBADO','OBSOLETO'];
const DOC_TYPE_LABELS = {
  REQUERIMIENTOS:'Requerimientos', ARQUITECTURA:'Arquitectura', DISEÑO:'Diseño',
  API:'API', BASE_DATOS:'Base de Datos', MANUAL_USUARIO:'Manual de Usuario',
  MANUAL_TECNICO:'Manual Técnico', PRUEBAS:'Pruebas', DESPLIEGUE:'Despliegue', OTRO:'Otro',
};
const EMPTY = { title:'', doc_type:'OTRO', version:'1.0', status:'BORRADOR', description:'', file_url:'', tags:'', review_due_date:'', task_id:'' };

/* ── helpers ────────────────────────────────────────────────────────────── */

function fmtSize(b) {
  if (!b) return '';
  if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
}

function DocIcon({ mime, size = 16 }) {
  if (!mime) return <File size={size} className="text-slate-400" />;
  if (mime === 'application/pdf')  return <FileText       size={size} className="text-red-500" />;
  if (mime.includes('word') || mime.includes('document')) return <FileText size={size} className="text-blue-500" />;
  if (mime.includes('sheet') || mime.includes('excel'))  return <FileSpreadsheet size={size} className="text-emerald-600" />;
  if (mime.includes('presentation') || mime.includes('powerpoint')) return <Presentation size={size} className="text-orange-500" />;
  if (mime.startsWith('image/')) return <Image   size={size} className="text-purple-500" />;
  if (mime.includes('zip'))      return <Archive size={size} className="text-amber-500" />;
  return <File size={size} className="text-slate-400" />;
}

function ReviewDueBadge({ date }) {
  if (!date) return null;
  const days  = Math.ceil((new Date(date) - new Date()) / 86_400_000);
  const color = days < 0   ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
              : days <= 7  ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
              : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400';
  const label = days < 0 ? `Revisión vencida hace ${-days}d`
              : days === 0 ? 'Revisión hoy'
              : `Revisar en ${days}d`;
  return <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${color}`}>{label}</span>;
}

/* ── File picker ─────────────────────────────────────────────────────────── */

function FilePicker({ file, setFile, fileUrl, setFileUrl }) {
  const inputRef  = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState(fileUrl ? 'url' : 'file');

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) { setFile(f); setFileUrl(''); }
  };

  const tabCls = (active) =>
    `flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs transition-colors ` +
    (active ? 'bg-indigo-600 text-white border-indigo-600'
            : 'border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-indigo-400');

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <button type="button" onClick={() => { setMode('file'); setFileUrl(''); }} className={tabCls(mode==='file')}>
          <Upload size={11} /> Subir archivo
        </button>
        <button type="button" onClick={() => { setMode('url'); setFile(null); }} className={tabCls(mode==='url')}>
          <Link size={11} /> URL externa
        </button>
      </div>

      {mode === 'file' ? (
        file ? (
          <div className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-xl px-4 py-3">
            <DocIcon mime={file.type} size={18} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{file.name}</p>
              <p className="text-xs text-slate-400">{fmtSize(file.size)}</p>
            </div>
            <button type="button" onClick={() => setFile(null)} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl px-4 py-6 text-center cursor-pointer transition-colors
              ${dragging ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                         : 'border-slate-200 dark:border-slate-600 hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}>
            <Upload size={22} className="mx-auto mb-2 text-slate-300 dark:text-slate-500" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Arrastra o <span className="text-indigo-600 font-medium">selecciona un archivo</span>
            </p>
            <p className="text-xs text-slate-400 mt-0.5">PDF, Word, Excel, PPT, imágenes, ZIP — máx 30 MB</p>
          </div>
        )
      ) : (
        <input type="url" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)}
          placeholder="https://drive.google.com/…"
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      )}

      <input ref={inputRef} type="file" className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.jpg,.jpeg,.png,.gif,.webp,.svg,.zip"
        onChange={(e) => { if (e.target.files[0]) { setFile(e.target.files[0]); setFileUrl(''); } }} />
    </div>
  );
}

/* ── Field wrapper ─────────────────────────────────────────────────────── */

const inputCls = 'w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500';

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

/* ── Doc form (shared create/edit) ──────────────────────────────────────── */

function DocForm({ form, setForm, file, setFile, fileUrl, setFileUrl, tasks, onSubmit, onCancel, saving, title, submitLabel }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {title && <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h4>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <Field label="Título *">
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
          </Field>
        </div>
        <Field label="Tipo">
          <select value={form.doc_type} onChange={(e) => setForm({ ...form, doc_type: e.target.value })} className={inputCls}>
            {DOC_TYPES.map((t) => <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>)}
          </select>
        </Field>
        <Field label="Estado">
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Versión">
          <input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="1.0" className={inputCls} />
        </Field>
        <Field label="Revisar antes del">
          <input type="date" value={form.review_due_date || ''} onChange={(e) => setForm({ ...form, review_due_date: e.target.value })} className={inputCls} />
        </Field>
        {tasks.length > 0 && (
          <div className="sm:col-span-2">
            <Field label="Vincular a tarea (opcional)">
              <select value={form.task_id || ''} onChange={(e) => setForm({ ...form, task_id: e.target.value })} className={inputCls}>
                <option value="">Sin tarea vinculada</option>
                {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </Field>
          </div>
        )}
        <div className="sm:col-span-2">
          <Field label="Tags (separados por coma)">
            <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="backend, api, v2" className={inputCls} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Descripción">
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Resumen del contenido…" className={inputCls + ' resize-none'} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Archivo o URL">
            <FilePicker file={file} setFile={setFile} fileUrl={fileUrl} setFileUrl={setFileUrl} />
          </Field>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 px-3 py-2 transition-colors">
          Cancelar
        </button>
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50 transition-colors">
          {saving && <Loader2 size={13} className="animate-spin" />}
          {submitLabel || 'Guardar'}
        </button>
      </div>
    </form>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */

export default function TechnicalDocList({ projectId, isManager = false }) {
  const { user }              = useAuthStore();
  const [docs, setDocs]       = useState([]);
  const [tasks, setTasks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]   = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [preview, setPreview] = useState(null);  // doc to preview
  const [approveDoc, setApproveDoc] = useState(null); // doc pending approval
  const [approveComment, setApproveComment] = useState('');

  // Filters & sort
  const [filterType, setFilterType] = useState('');
  const [search, setSearch]         = useState('');
  const [sortField, setSortField]   = useState('sort_order');
  const [sortDir, setSortDir]       = useState('asc');

  // Create form
  const [form, setForm]       = useState({ ...EMPTY });
  const [file, setFile]       = useState(null);
  const [fileUrl, setFileUrl] = useState('');

  // Edit form
  const [editForm, setEditForm]       = useState({});
  const [editFile, setEditFile]       = useState(null);
  const [editFileUrl, setEditFileUrl] = useState('');

  // Doc signatures
  const [signaturesMap, setSignaturesMap] = useState({});  // docId -> []
  const [signingId, setSigningId]         = useState(null);

  const load = () =>
    projectsAPI.getTechnicalDocs(projectId)
      .then((r) => setDocs(r.data.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));

  const loadSignatures = (docId) => {
    projectsAPI.getDocSignatures(docId)
      .then(r => setSignaturesMap(prev => ({ ...prev, [docId]: r.data ?? [] })))
      .catch(() => {});
  };

  const signDocument = async (docId) => {
    if (!confirm('¿Firmar digitalmente este documento? Tu identidad y timestamp quedarán registrados.')) return;
    setSigningId(docId);
    try {
      await projectsAPI.signDocument(docId);
      toast.success('Documento firmado');
      loadSignatures(docId);
    } catch { toast.error('Error al firmar'); }
    finally { setSigningId(null); }
  };

  useEffect(() => {
    load();
    // Load tasks for linking
    projectsAPI.getTasks({ project_id: projectId, per_page: 200 })
      .then((r) => setTasks(r.data.data ?? r.data ?? []))
      .catch(() => {});
  }, [projectId]);

  /* ── Create ── */
  const submit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v !== '' && v != null) fd.append(k, v); });
      if (file)    fd.append('file', file);
      if (fileUrl) fd.set('file_url', fileUrl);
      await projectsAPI.uploadTechnicalDoc(projectId, fd);
      toast.success('Documento registrado');
      setForm({ ...EMPTY }); setFile(null); setFileUrl('');
      setShowForm(false); load();
    } catch { toast.error('Error al crear documento'); }
    finally { setSaving(false); }
  };

  /* ── Edit ── */
  const startEdit = (d) => {
    setEditId(d.id);
    setEditForm({ title: d.title, doc_type: d.doc_type, version: d.version, status: d.status,
                  description: d.description || '', tags: d.tags || '',
                  review_due_date: d.review_due_date || '', task_id: d.task_id || '' });
    setEditFile(null); setEditFileUrl(d.file_url || '');
  };

  const saveEdit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(editForm).forEach(([k, v]) => { if (v !== '' && v != null) fd.append(k, v); });
      if (editFile)    fd.append('file', editFile);
      if (editFileUrl) fd.set('file_url', editFileUrl);
      await projectsAPI.updateTechnicalDoc(editId, fd);
      toast.success('Documento actualizado');
      setEditId(null); setEditFile(null); setEditFileUrl(''); load();
    } catch { toast.error('Error al actualizar'); }
    finally { setSaving(false); }
  };

  /* ── Approve ── */
  const doApprove = async () => {
    try {
      await projectsAPI.approveTechnicalDoc(approveDoc.id, { comment: approveComment });
      toast.success('Documento aprobado');
      setApproveDoc(null); setApproveComment(''); load();
    } catch { toast.error('Error al aprobar'); }
  };

  const doRequestReview = async (d) => {
    try {
      await projectsAPI.requestTechnicalDocReview(d.id);
      toast.success('Revisión solicitada');
      load();
    } catch { toast.error('Error'); }
  };

  /* ── Sort ── */
  const toggleSort = (field) => {
    if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortBtn = ({ field, label }) => {
    const active = sortField === field;
    return (
      <button onClick={() => toggleSort(field)}
        className={`flex items-center gap-0.5 text-xs rounded px-1.5 py-0.5 transition-colors
          ${active ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
        {label}
        {active ? (sortDir === 'asc' ? <SortAsc size={11} /> : <SortDesc size={11} />) : null}
      </button>
    );
  };

  const moveSort = async (doc, dir) => {
    const sorted = [...displayed];
    const idx    = sorted.findIndex((d) => d.id === doc.id);
    if ((dir === -1 && idx === 0) || (dir === 1 && idx === sorted.length - 1)) return;
    // Swap sort_order values
    const target = sorted[idx + dir];
    await Promise.all([
      projectsAPI.sortTechnicalDoc(doc.id,    idx + dir),
      projectsAPI.sortTechnicalDoc(target.id, idx),
    ]);
    load();
  };

  /* ── Derived ── */
  const typeCounts  = docs.reduce((a, d) => ({ ...a, [d.doc_type]: (a[d.doc_type] || 0) + 1 }), {});
  const taskMap     = Object.fromEntries(tasks.map((t) => [t.id, t.title]));

  const displayed = docs
    .filter((d) => {
      if (filterType && d.doc_type !== filterType) return false;
      if (search) {
        const q = search.toLowerCase();
        return (d.title + d.description + d.tags + d.doc_type).toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      let va = a[sortField] ?? 0, vb = b[sortField] ?? 0;
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });

  const approvedCount = docs.filter((d) => d.status === 'APROBADO').length;
  const overdueReview = docs.filter((d) => d.review_due_date && new Date(d.review_due_date) < new Date()).length;

  if (loading) return <p className="text-center py-12 text-slate-400">Cargando…</p>;

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-slate-700 dark:text-slate-200">
            Documentación Técnica <span className="text-slate-400 font-normal">({docs.length})</span>
          </h3>
          <div className="flex items-center gap-3 mt-0.5">
            {approvedCount > 0 && <span className="text-xs text-emerald-600">{approvedCount} aprobado{approvedCount > 1 ? 's' : ''}</span>}
            {overdueReview > 0 && <span className="text-xs text-red-500">⚠ {overdueReview} con revisión vencida</span>}
          </div>
        </div>
        {isManager && !showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Plus size={14} /> Nuevo documento
          </button>
        )}
      </div>

      {/* Search + Sort */}
      {docs.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título, descripción, tags…"
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            Ordenar:
            <SortBtn field="sort_order" label="Manual" />
            <SortBtn field="title" label="Nombre" />
            <SortBtn field="created_at" label="Fecha" />
            <SortBtn field="status" label="Estado" />
            <SortBtn field="download_count" label="↓" />
          </div>
        </div>
      )}

      {/* Type filter chips */}
      {docs.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilterType('')}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors
              ${!filterType ? 'bg-indigo-600 text-white border-indigo-600'
                           : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-indigo-400'}`}>
            Todos ({docs.length})
          </button>
          {Object.entries(typeCounts).map(([type, count]) => (
            <button key={type} onClick={() => setFilterType(type === filterType ? '' : type)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors
                ${filterType === type ? 'bg-indigo-600 text-white border-indigo-600'
                                      : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-indigo-400'}`}>
              {DOC_TYPE_LABELS[type] || type} ({count})
            </button>
          ))}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-5 border border-slate-200 dark:border-slate-600">
          <DocForm form={form} setForm={setForm} file={file} setFile={setFile}
            fileUrl={fileUrl} setFileUrl={setFileUrl} tasks={tasks}
            onSubmit={submit} onCancel={() => { setShowForm(false); setFile(null); setFileUrl(''); }}
            saving={saving} title="Nuevo documento técnico" submitLabel="Registrar documento" />
        </div>
      )}

      {/* List */}
      {docs.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <FileText size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sin documentación técnica aún.</p>
          <p className="text-xs mt-1">Añade diagramas, manuales, especificaciones de API y más.</p>
          {isManager && !showForm && (
            <button onClick={() => setShowForm(true)}
              className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              Subir primer documento
            </button>
          )}
        </div>
      ) : displayed.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-6">Sin coincidencias.</p>
      ) : (
        <div className="space-y-3">
          {displayed.map((d, idx) => {
            const hasFile  = !!d.stored_name;
            const hasUrl   = !!d.file_url && !d.stored_name;
            const canPreview = hasFile && (d.mime_type === 'application/pdf' || d.mime_type?.startsWith('image/'));
            const isEdit   = editId === d.id;
            const isOverdue = d.review_due_date && new Date(d.review_due_date) < new Date();
            const linkedTask = d.task_id ? taskMap[d.task_id] : null;

            return (
              <div key={d.id}
                className={`bg-white dark:bg-slate-800 border rounded-xl overflow-hidden transition-colors
                  ${isOverdue ? 'border-amber-300 dark:border-amber-700' : 'border-slate-200 dark:border-slate-700'}`}>

                {isEdit ? (
                  <div className="p-4">
                    <DocForm form={editForm} setForm={setEditForm}
                      file={editFile} setFile={setEditFile}
                      fileUrl={editFileUrl} setFileUrl={setEditFileUrl}
                      tasks={tasks} onSubmit={saveEdit}
                      onCancel={() => { setEditId(null); setEditFile(null); setEditFileUrl(''); }}
                      saving={saving} submitLabel="Guardar cambios" />
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Icon / Thumbnail */}
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden bg-slate-100 dark:bg-slate-700">
                        {hasFile && d.mime_type?.startsWith('image/') ? (
                          <img src={projectsAPI.getTechnicalDocDownloadUrl(d.id)}
                            alt={d.title} className="w-full h-full object-cover" />
                        ) : (
                          <DocIcon mime={d.mime_type} size={20} />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{d.title}</span>
                          <span className="text-xs text-slate-400 font-mono">v{d.version}</span>
                          {d.download_count > 0 && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                              <Download size={9} />{d.download_count}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
                            {DOC_TYPE_LABELS[d.doc_type] || d.doc_type}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[d.status]}`}>
                            {d.status.replace('_', ' ')}
                          </span>
                          {hasFile && <span className="text-xs text-slate-400">{fmtSize(d.size_bytes)}</span>}
                          <ReviewDueBadge date={d.review_due_date} />
                        </div>
                        {d.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2">{d.description}</p>
                        )}
                        {d.tags && (
                          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                            <Tag size={10} className="text-slate-400" />
                            {d.tags.split(',').map((t) => t.trim()).filter(Boolean).map((tag) => (
                              <span key={tag} className="text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded">{tag}</span>
                            ))}
                          </div>
                        )}
                        {linkedTask && (
                          <p className="text-[10px] text-slate-400 mt-1">🔗 Tarea: {linkedTask}</p>
                        )}
                        {d.status === 'APROBADO' && d.approved_by && (
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                            <CheckCircle2 size={10} /> Aprobado {d.approved_at?.slice(0, 10)}
                            {d.approval_comment && <span className="italic"> — {d.approval_comment}</span>}
                          </p>
                        )}
                        {hasFile && d.original_name && (
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate">{d.original_name}</p>
                        )}
                      </div>

                      {/* Actions column */}
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <div className="flex items-center gap-1">
                          {/* Preview */}
                          {canPreview && (
                            <button onClick={() => setPreview(d)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                              title="Vista previa">
                              <Eye size={14} />
                            </button>
                          )}
                          {/* Download */}
                          {hasFile && (
                            <a href={projectsAPI.getTechnicalDocDownloadUrl(d.id)} download={d.original_name}
                              className="p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                              title="Descargar">
                              <Download size={14} />
                            </a>
                          )}
                          {hasUrl && (
                            <a href={d.file_url} target="_blank" rel="noreferrer"
                              className="p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                              title="Abrir enlace">
                              <ExternalLink size={14} />
                            </a>
                          )}
                          {isManager && (
                            <>
                              <button onClick={() => startEdit(d)} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => setConfirm({ title:'Eliminar documento', body:`¿Eliminar "${d.title}"?`,
                                onConfirm: async () => { await projectsAPI.deleteTechnicalDoc(d.id); toast.success('Eliminado'); load(); } })}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>

                        {/* Sort up/down */}
                        {isManager && sortField === 'sort_order' && (
                          <div className="flex gap-0.5">
                            <button onClick={() => moveSort(d, -1)} disabled={idx === 0}
                              className="p-0.5 text-slate-300 hover:text-slate-500 disabled:opacity-20 transition-colors">
                              <ChevronUp size={13} />
                            </button>
                            <button onClick={() => moveSort(d, 1)} disabled={idx === displayed.length - 1}
                              className="p-0.5 text-slate-300 hover:text-slate-500 disabled:opacity-20 transition-colors">
                              <ChevronDown size={13} />
                            </button>
                          </div>
                        )}

                        {/* Approval buttons */}
                        {isManager && d.status === 'BORRADOR' && (
                          <button onClick={() => doRequestReview(d)}
                            className="flex items-center gap-1 text-[10px] text-amber-600 hover:text-amber-700 border border-amber-300 hover:border-amber-400 px-2 py-0.5 rounded-lg transition-colors">
                            <Clock size={9} /> Solicitar revisión
                          </button>
                        )}
                        {isManager && d.status === 'EN_REVISION' && (
                          <button onClick={() => setApproveDoc(d)}
                            className="flex items-center gap-1 text-[10px] text-emerald-600 hover:text-emerald-700 border border-emerald-300 hover:border-emerald-400 px-2 py-0.5 rounded-lg transition-colors">
                            <CheckCircle2 size={9} /> Aprobar
                          </button>
                        )}
                        {/* Sign button */}
                        <button
                          onClick={() => {
                            loadSignatures(d.id);
                            signDocument(d.id);
                          }}
                          disabled={signingId === d.id}
                          className="flex items-center gap-1 text-[10px] text-violet-600 hover:text-violet-700 border border-violet-300 hover:border-violet-400 px-2 py-0.5 rounded-lg transition-colors disabled:opacity-50">
                          <PenLine size={9} /> {signingId === d.id ? 'Firmando…' : 'Firmar'}
                        </button>
                      </div>
                    </div>

                    {/* Signatures panel */}
                    {signaturesMap[d.id] && signaturesMap[d.id].length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/50">
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                          <ShieldCheck size={10} /> Firmas digitales ({signaturesMap[d.id].length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {signaturesMap[d.id].map(sig => (
                            <div key={sig.id} className="flex items-center gap-1.5 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-lg px-2 py-1">
                              <ShieldCheck size={10} className="text-violet-600 dark:text-violet-400" />
                              <span className="text-[10px] text-violet-700 dark:text-violet-300 font-medium">{sig.signer_name ?? 'Usuario'}</span>
                              <span className="text-[10px] text-slate-400">{sig.signed_at?.slice(0, 10)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Version history + comments (collapsible) */}
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/50 flex flex-wrap gap-4">
                      {hasFile && <DocVersionHistory docId={d.id} />}
                      <DocComments docId={d.id} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Approve modal */}
      {approveDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Aprobar documento</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              ¿Aprobar <strong>"{approveDoc.title}"</strong>?
            </p>
            <textarea rows={2} value={approveComment} onChange={(e) => setApproveComment(e.target.value)}
              placeholder="Comentario de aprobación (opcional)"
              className={inputCls + ' resize-none'} />
            <div className="flex gap-3">
              <button onClick={() => { setApproveDoc(null); setApproveComment(''); }}
                className="flex-1 border border-slate-300 dark:border-slate-600 text-sm rounded-lg py-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                Cancelar
              </button>
              <button onClick={doApprove}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg py-2 flex items-center justify-center gap-2 transition-colors">
                <CheckCircle2 size={14} /> Aprobar
              </button>
            </div>
          </div>
        </div>
      )}

      {preview && <DocPreviewModal doc={preview} onClose={() => setPreview(null)} />}
      {confirm && <ConfirmModal {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}
