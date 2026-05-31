import { useEffect, useState, useCallback } from 'react';
import { projectsAPI } from '../../services/projectsAPI';
import { useAuthStore } from '../../stores/authStore';
import { toast } from 'sonner';
import {
  BookOpen, Plus, Pencil, Trash2, Save, X,
  ChevronRight, ChevronDown, FileText, Loader2, PenLine,
} from 'lucide-react';

const EXCALIDRAW_URL = 'https://excalidraw.com';

/* ── simple rich-text-like textarea editor ─────────────────────── */
function Editor({ value, onChange, placeholder }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || 'Escribe aquí con markdown soportado…'}
      rows={14}
      className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm font-mono bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
    />
  );
}

/* ── render content (basic markdown) ───────────────────────────── */
function Render({ content }) {
  if (!content) return <p className="text-slate-400 italic text-sm">Sin contenido.</p>;
  const lines = content.split('\n');
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-200 space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith('# '))    return <h1 key={i} className="text-xl font-bold mt-3">{line.slice(2)}</h1>;
        if (line.startsWith('## '))   return <h2 key={i} className="text-lg font-semibold mt-2">{line.slice(3)}</h2>;
        if (line.startsWith('### '))  return <h3 key={i} className="text-base font-semibold mt-2">{line.slice(4)}</h3>;
        if (line.startsWith('- '))    return <li key={i} className="ml-4 list-disc">{line.slice(2)}</li>;
        if (line.startsWith('> '))    return <blockquote key={i} className="border-l-4 border-slate-300 pl-3 italic text-slate-500">{line.slice(2)}</blockquote>;
        if (line.startsWith('```'))   return <div key={i} className="font-mono text-xs bg-slate-100 dark:bg-slate-700 rounded px-2 py-0.5">{line.slice(3)}</div>;
        if (!line.trim())             return <div key={i} className="h-2" />;
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

/* ── Page tree item ─────────────────────────────────────────────── */
function PageItem({ page, depth, selectedId, onSelect, onDelete, isManager }) {
  const [open, setOpen] = useState(false);
  const hasChildren = page.children?.length > 0;
  const isSelected = selectedId === page.id;

  return (
    <div>
      <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer group transition-colors
        ${isSelected ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                     : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-300'}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onSelect(page.id)}>
        {hasChildren ? (
          <button onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
            className="text-slate-400 flex-shrink-0">
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : <FileText size={12} className="text-slate-400 flex-shrink-0" />}
        <span className="text-xs truncate flex-1">{page.title}</span>
        {isManager && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(page); }}
            className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all flex-shrink-0">
            <Trash2 size={11} />
          </button>
        )}
      </div>
      {open && hasChildren && page.children.map((child) => (
        <PageItem key={child.id} page={child} depth={depth + 1}
          selectedId={selectedId} onSelect={onSelect} onDelete={onDelete} isManager={isManager} />
      ))}
    </div>
  );
}

/* ── Main WikiView ──────────────────────────────────────────────── */
export default function WikiView({ projectId, isManager }) {
  const { user }            = useAuthStore();
  const [pages, setPages]   = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [page, setPage]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [loadingPage, setLoadingPage] = useState(false);
  const [editing, setEditing]         = useState(false);
  const [editTitle, setEditTitle]     = useState('');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving]           = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [newTitle, setNewTitle]       = useState('');
  const [showCanvas, setShowCanvas]   = useState(false);

  const buildTree = (flatPages) => {
    const map = {};
    flatPages.forEach((p) => { map[p.id] = { ...p, children: [] }; });
    const roots = [];
    flatPages.forEach((p) => {
      if (p.parent_id && map[p.parent_id]) map[p.parent_id].children.push(map[p.id]);
      else roots.push(map[p.id]);
    });
    return roots;
  };

  const load = useCallback(() => {
    projectsAPI.getWikiPages(projectId)
      .then((r) => setPages(buildTree(r.data ?? [])))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selectedId) { setPage(null); return; }
    setLoadingPage(true);
    projectsAPI.getWikiPage(selectedId)
      .then((r) => { setPage(r.data); setEditing(false); })
      .catch(() => {})
      .finally(() => setLoadingPage(false));
  }, [selectedId]);

  const createPage = async () => {
    if (!newTitle.trim()) return;
    const r = await projectsAPI.createWikiPage(projectId, { title: newTitle, content: '' });
    toast.success('Página creada');
    setShowNew(false); setNewTitle(''); load();
    setSelectedId(r.data.id);
  };

  const savePage = async () => {
    setSaving(true);
    try {
      await projectsAPI.updateWikiPage(selectedId, { title: editTitle, content: editContent });
      toast.success('Página guardada');
      setEditing(false); setPage((p) => ({ ...p, title: editTitle, content: editContent }));
      load();
    } catch { toast.error('Error al guardar'); }
    finally { setSaving(false); }
  };

  const deletePage = async (p) => {
    if (!confirm(`¿Eliminar "${p.title}"?`)) return;
    await projectsAPI.deleteWikiPage(p.id);
    toast.success('Página eliminada'); load();
    if (selectedId === p.id) setSelectedId(null);
  };

  const startEdit = () => { setEditTitle(page.title); setEditContent(page.content || ''); setEditing(true); };

  return (
    <div className="flex gap-4 h-[550px]">
      {/* Sidebar */}
      <div className="w-52 flex-shrink-0 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-1.5">
            <BookOpen size={14} className="text-indigo-500" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Wiki</span>
          </div>
          {isManager && (
            <button onClick={() => setShowNew((v) => !v)} className="p-0.5 text-slate-400 hover:text-indigo-600 transition-colors">
              <Plus size={14} />
            </button>
          )}
        </div>
        {showNew && (
          <div className="px-2 py-2 border-b border-slate-100 dark:border-slate-700 flex gap-1">
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createPage()}
              placeholder="Título…" autoFocus
              className="flex-1 min-w-0 text-xs border border-slate-200 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            <button onClick={createPage} className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 text-xs font-medium">OK</button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto py-1">
          {loading && <p className="text-xs text-slate-400 px-3 py-2">Cargando…</p>}
          {!loading && pages.length === 0 && (
            <p className="text-xs text-slate-400 px-3 py-4 text-center italic">Sin páginas aún.</p>
          )}
          {pages.map((p) => (
            <PageItem key={p.id} page={p} depth={0}
              selectedId={selectedId} onSelect={setSelectedId} onDelete={deletePage} isManager={isManager} />
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
        {!selectedId ? (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <BookOpen size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Selecciona una página del panel izquierdo</p>
              {isManager && <p className="text-xs mt-1">o crea una nueva con el botón <Plus size={11} className="inline" /></p>}
            </div>
          </div>
        ) : loadingPage ? (
          <div className="flex-1 flex items-center justify-center text-slate-400"><Loader2 size={20} className="animate-spin" /></div>
        ) : page ? (
          <>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
              {editing ? (
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                  className="flex-1 text-base font-semibold bg-transparent border-b border-indigo-300 focus:outline-none dark:text-slate-100 mr-4" />
              ) : (
                <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{page.title}</h2>
              )}
              <div className="flex items-center gap-2 flex-shrink-0">
                {editing ? (
                  <>
                    <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"><X size={15} /></button>
                    <button onClick={savePage} disabled={saving}
                      className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors">
                      {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Guardar
                    </button>
                  </>
                ) : isManager ? (
                  <button onClick={startEdit}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600 px-2.5 py-1 rounded-lg transition-colors">
                    <Pencil size={12} /> Editar
                  </button>
                ) : null}
                {/* Whiteboard toggle */}
                <button onClick={() => setShowCanvas(v => !v)}
                  title="Pizarrón colaborativo (Excalidraw)"
                  className={`flex items-center gap-1 text-xs border px-2.5 py-1 rounded-lg transition-colors ${showCanvas ? 'bg-violet-600 text-white border-violet-600' : 'text-slate-500 hover:text-violet-600 dark:text-slate-400 border-slate-200 dark:border-slate-600'}`}>
                  <PenLine size={12} /> Pizarrón
                </button>
              </div>
            </div>
            {/* Excalidraw whiteboard */}
            {showCanvas && (
              <div className="border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                <iframe
                  src={EXCALIDRAW_URL}
                  title="Pizarrón colaborativo"
                  className="w-full"
                  style={{ height: '480px', border: 'none' }}
                  allow="clipboard-read; clipboard-write"
                />
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {editing ? (
                <Editor value={editContent} onChange={setEditContent} />
              ) : (
                <Render content={page.content} />
              )}
            </div>
            {page.updated_at && !editing && (
              <p className="px-5 py-2 text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-700 flex-shrink-0">
                Última edición: {page.updated_at?.slice(0, 16)} · {page.updated_by_name}
              </p>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
