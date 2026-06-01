import { useRef, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, Link2,
  List, ListOrdered, CheckSquare, Heading2, Heading3,
  Quote, Highlighter, Undo, Redo, Minus,
} from 'lucide-react';

/* ─── Toolbar button ─────────────────────────────────────────────── */
function Btn({ onClick, active, disabled, title, children }) {
  return (
    <button type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      disabled={disabled} title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200'
      } disabled:opacity-30 disabled:cursor-default`}>
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-0.5 self-center" />;
}

/* ─── RichTextEditor ────────────────────────────────────────────── */
export default function RichTextEditor({
  value = '',
  onChange,
  placeholder = 'Escribe una descripción…',
  minHeight = 120,
  disabled = false,
  className = '',
}) {
  const lastValueRef = useRef(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Highlight.configure({ multicolor: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      TaskList,
      TaskItem.configure({ nested: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange?.(html === '<p></p>' ? '' : html);
    },
  });

  // Sync external value changes (e.g. restoring description from history)
  useEffect(() => {
    if (editor && value !== lastValueRef.current) {
      editor.commands.setContent(value || '', false);
      lastValueRef.current = value;
    }
  }, [value, editor]);

  if (!editor) return null;

  const setLink = () => {
    const prev = editor.getAttributes('link').href || '';
    const url  = window.prompt('URL del enlace:', prev);
    if (url === null) return;
    if (url === '') { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className={`border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden bg-white dark:bg-slate-800 ${className}`}>
      {/* Toolbar */}
      {!disabled && (
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
          <Btn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Deshacer"><Undo size={14} /></Btn>
          <Btn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Rehacer"><Redo size={14} /></Btn>
          <Divider />
          <Btn onClick={() => editor.chain().focus().toggleBold().run()}      active={editor.isActive('bold')}      title="Negrita (Ctrl+B)"><Bold size={14} /></Btn>
          <Btn onClick={() => editor.chain().focus().toggleItalic().run()}    active={editor.isActive('italic')}    title="Cursiva (Ctrl+I)"><Italic size={14} /></Btn>
          <Btn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Subrayado (Ctrl+U)"><UnderlineIcon size={14} /></Btn>
          <Btn onClick={() => editor.chain().focus().toggleStrike().run()}    active={editor.isActive('strike')}    title="Tachado"><Strikethrough size={14} /></Btn>
          <Btn onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="Resaltar"><Highlighter size={14} /></Btn>
          <Divider />
          <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Título H2"><Heading2 size={14} /></Btn>
          <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Subtítulo H3"><Heading3 size={14} /></Btn>
          <Divider />
          <Btn onClick={() => editor.chain().focus().toggleBulletList().run()}   active={editor.isActive('bulletList')}   title="Lista de puntos"><List size={14} /></Btn>
          <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()}  active={editor.isActive('orderedList')}  title="Lista numerada"><ListOrdered size={14} /></Btn>
          <Btn onClick={() => editor.chain().focus().toggleTaskList().run()}     active={editor.isActive('taskList')}     title="Lista de checks"><CheckSquare size={14} /></Btn>
          <Divider />
          <Btn onClick={() => editor.chain().focus().toggleCode().run()}         active={editor.isActive('code')}         title="Código inline"><Code size={14} /></Btn>
          <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()}   active={editor.isActive('blockquote')}   title="Cita"><Quote size={14} /></Btn>
          <Btn onClick={setLink}                                                  active={editor.isActive('link')}          title="Insertar enlace"><Link2 size={14} /></Btn>
          <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()}  title="Separador horizontal"><Minus size={14} /></Btn>
        </div>
      )}

      {/* Content */}
      <EditorContent
        editor={editor}
        className="rich-editor px-3 py-2.5 text-sm focus-within:outline-none"
        style={{ minHeight }}
      />
    </div>
  );
}
