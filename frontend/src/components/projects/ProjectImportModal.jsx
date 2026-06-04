import { useState, useRef } from 'react';
import { X, Upload, Download, FileText, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { projectsAPI } from '../../services/projectsAPI';
import { toast } from 'sonner';

export default function ProjectImportModal({ onClose, onImported }) {
  const [file, setFile]       = useState(null);
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef();

  async function handleDownloadTemplate() {
    try {
      const res = await projectsAPI.downloadProjectsTemplate();
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a   = document.createElement('a');
      a.href = url; a.download = 'plantilla_importar_proyectos.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('No se pudo descargar la plantilla');
    }
  }

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await projectsAPI.importProjectsCSV(form);
      setResult(res.data);
      if (res.data.created > 0) {
        toast.success(res.data.message);
        onImported?.();
      } else {
        toast.warning(res.data.message);
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Error al importar el CSV';
      toast.error(msg);
      setResult({ created: 0, skipped: 0, errors: [msg] });
    } finally {
      setLoading(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith('.csv')) setFile(f);
    else toast.error('Solo se aceptan archivos .csv');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">Importar proyectos desde CSV</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Solo administradores</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">

          {/* Download template */}
          <button
            onClick={handleDownloadTemplate}
            className="w-full flex items-center gap-3 px-4 py-3 border-2 border-dashed border-indigo-300 dark:border-indigo-600
              rounded-xl text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
            <Download size={18} />
            <div className="text-left">
              <p className="text-sm font-semibold">Descargar plantilla CSV</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Incluye columnas y ejemplo de referencia</p>
            </div>
          </button>

          {/* Columns reference */}
          <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-3.5 text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
            <p className="font-semibold text-slate-700 dark:text-slate-300">Columnas del CSV</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {[
                ['code *', 'Código único (ej. PRY-001)'],
                ['name *', 'Nombre del proyecto'],
                ['description', 'Descripción breve'],
                ['category', 'Nombre de categoría'],
                ['status', 'INICIACION / PLANIFICACION…'],
                ['priority', 'BAJA / MEDIA / ALTA / CRITICA'],
                ['director', 'Username del director'],
                ['sponsor', 'Username del sponsor'],
                ['planned_start_date', 'YYYY-MM-DD'],
                ['planned_end_date', 'YYYY-MM-DD'],
                ['planned_budget', 'Número (ej. 250000)'],
                ['client_name', 'Razón social'],
                ['client_email', 'Correo cliente'],
                ['objectives', 'Texto libre'],
              ].map(([col, hint]) => (
                <div key={col} className="flex gap-1">
                  <span className="font-mono text-indigo-600 dark:text-indigo-400 shrink-0">{col}</span>
                  <span className="text-slate-400 truncate">{hint}</span>
                </div>
              ))}
            </div>
            <p className="text-slate-400">* obligatorio</p>
          </div>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer border-2 border-dashed rounded-xl p-6 text-center transition-colors
              ${file
                ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/10'}`}>
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => setFile(e.target.files[0] || null)}
            />
            {file ? (
              <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400">
                <FileText size={20} />
                <span className="text-sm font-medium">{file.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); setResult(null); }}
                  className="ml-1 text-slate-400 hover:text-red-500">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="text-slate-400 dark:text-slate-500">
                <Upload size={28} className="mx-auto mb-1.5 opacity-60" />
                <p className="text-sm">Arrastra tu CSV aquí o <span className="text-indigo-600 dark:text-indigo-400 font-medium">haz clic</span></p>
                <p className="text-xs mt-0.5">Solo archivos .csv</p>
              </div>
            )}
          </div>

          {/* Result */}
          {result && (
            <div className={`rounded-xl p-3.5 text-sm space-y-2 ${
              result.created > 0
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
            }`}>
              <div className="flex items-center gap-2 font-semibold">
                {result.created > 0
                  ? <CheckCircle2 size={16} />
                  : <AlertCircle size={16} />}
                {result.message}
              </div>
              {result.errors?.length > 0 && (
                <ul className="text-xs space-y-0.5 text-slate-600 dark:text-slate-400 list-disc list-inside max-h-32 overflow-y-auto">
                  {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600
              text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-medium transition-colors">
            Cerrar
          </button>
          <button
            onClick={handleImport}
            disabled={!file || loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
              bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed
              text-white text-sm font-semibold transition-colors">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {loading ? 'Importando…' : 'Importar proyectos'}
          </button>
        </div>
      </div>
    </div>
  );
}
