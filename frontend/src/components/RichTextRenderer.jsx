/**
 * RichTextRenderer — renderiza HTML de TipTap de forma segura.
 * Aplica clases Tailwind Typography para una presentación limpia.
 */
export default function RichTextRenderer({ content, className = '' }) {
  if (!content || content === '<p></p>') {
    return <p className="text-slate-400 italic text-sm">Sin descripción.</p>;
  }

  // Si el contenido es texto plano (no HTML), envuélvelo
  const html = content.startsWith('<') ? content : `<p>${content}</p>`;

  return (
    <div
      className={`rich-render prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-200 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
