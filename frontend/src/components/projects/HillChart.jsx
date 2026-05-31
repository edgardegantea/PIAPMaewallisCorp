import { useEffect, useState } from 'react';
import { projectsAPI } from '../../services/projectsAPI';
import { toast } from 'sonner';
import { TrendingUp, Info } from 'lucide-react';

/**
 * Hill Chart (#10) — visualiza el progreso de épicas/features
 * La mitad izquierda de la colina = descubrimiento/incertidumbre
 * La mitad derecha = ejecución/certeza
 * El punto en la cima (50%) = punto de inflexión
 */

const HILL_W = 600;
const HILL_H = 200;
const PAD    = 40;

/** Calcula el punto y en la curva de colina dado x (0-100) */
function hillY(pct) {
  // Curva senoidal: 0% → fondo izq, 50% → cima, 100% → fondo der
  const x = (pct / 100) * Math.PI;
  return HILL_H - PAD - (Math.sin(x) * (HILL_H - 2 * PAD));
}

/** Coordenadas x en el SVG dado progreso 0-100 */
function hillX(pct) {
  return PAD + (pct / 100) * (HILL_W - 2 * PAD);
}

const COLORS = [
  '#6366f1','#3b82f6','#10b981','#f59e0b','#ef4444',
  '#8b5cf6','#ec4899','#14b8a6','#f97316','#64748b',
];

export default function HillChart({ projectId, isManager }) {
  const [epics, setEpics]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // epic id being dragged
  const [positions, setPositions] = useState({}); // epicId -> pct (0-100)
  const [saving, setSaving] = useState(false);

  const load = () => {
    projectsAPI.getEpics(projectId)
      .then(r => {
        const epicsData = r.data ?? [];
        setEpics(epicsData);
        // Use existing hill_position or derive from completion %
        const pos = {};
        epicsData.forEach(e => {
          pos[e.id] = parseFloat(e.hill_position ?? e.completion_pct ?? 0);
        });
        setPositions(pos);
      })
      .catch(() => toast.error('Error al cargar épicas'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [projectId]);

  const savePosition = async (epicId, pct) => {
    setSaving(true);
    try {
      await projectsAPI.updateEpic(epicId, { hill_position: Math.round(pct) });
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const handleSvgClick = (e) => {
    if (!isManager || !editing) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * HILL_W;
    const pct = Math.max(0, Math.min(100, ((rawX - PAD) / (HILL_W - 2 * PAD)) * 100));
    setPositions(prev => ({ ...prev, [editing]: Math.round(pct) }));
    savePosition(editing, Math.round(pct));
    setEditing(null);
  };

  // Build SVG path for hill curve
  const points = Array.from({ length: 101 }, (_, i) => `${hillX(i).toFixed(1)},${hillY(i).toFixed(1)}`).join(' ');

  if (loading) return <p className="py-10 text-center text-slate-400">Cargando…</p>;

  if (epics.length === 0) return (
    <div className="py-16 text-center">
      <TrendingUp size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
      <p className="text-slate-500 dark:text-slate-400 text-sm">Sin épicas para mostrar</p>
      <p className="text-xs text-slate-400 mt-1">Crea épicas en la pestaña Épicas para visualizarlas aquí</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
          <TrendingUp size={15} className="text-indigo-500" /> Hill Chart — Progreso de Épicas
        </h2>
        {saving && <span className="text-xs text-slate-400">Guardando…</span>}
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-2 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
        <Info size={12} className="flex-shrink-0" />
        <span>Izquierda = descubrimiento/incertidumbre · Derecha = ejecución/certeza{isManager && ' · Haz clic en una épica y luego en la colina para moverla'}</span>
      </div>

      {/* SVG Hill */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${HILL_W} ${HILL_H + 40}`}
          className="w-full max-w-2xl mx-auto cursor-crosshair"
          onClick={handleSvgClick}
          style={{ height: 'auto', minHeight: 180 }}
        >
          {/* Gradient fill under curve */}
          <defs>
            <linearGradient id="hill-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#e0e7ff" stopOpacity="0.6" />
              <stop offset="50%"  stopColor="#c7d2fe" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#e0e7ff" stopOpacity="0.6" />
            </linearGradient>
          </defs>

          {/* Filled area under curve */}
          <polyline
            points={`${PAD},${HILL_H - PAD} ${points} ${HILL_W - PAD},${HILL_H - PAD}`}
            fill="url(#hill-grad)" stroke="none"
          />
          {/* Hill curve */}
          <polyline points={points} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" />

          {/* Baseline */}
          <line x1={PAD} y1={HILL_H - PAD} x2={HILL_W - PAD} y2={HILL_H - PAD}
            stroke="#e2e8f0" strokeWidth="1.5" />

          {/* Center divider */}
          <line x1={hillX(50)} y1={PAD / 2} x2={hillX(50)} y2={HILL_H - PAD}
            stroke="#a5b4fc" strokeWidth="1" strokeDasharray="4,3" />

          {/* Labels */}
          <text x={PAD + 8} y={HILL_H + 20} fontSize="11" fill="#94a3b8">Descubrimiento</text>
          <text x={hillX(52)} y={HILL_H + 20} fontSize="11" fill="#94a3b8">Ejecución</text>

          {/* Epic dots */}
          {epics.map((epic, i) => {
            const pct = positions[epic.id] ?? 0;
            const cx  = hillX(pct);
            const cy  = hillY(pct);
            const color = COLORS[i % COLORS.length];
            const isSelected = editing === epic.id;

            return (
              <g key={epic.id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isManager) return;
                  setEditing(prev => prev === epic.id ? null : epic.id);
                }}
                style={{ cursor: isManager ? 'pointer' : 'default' }}>
                {/* Glow when selected */}
                {isSelected && (
                  <circle cx={cx} cy={cy} r={16} fill={color} opacity={0.2} />
                )}
                <circle cx={cx} cy={cy} r={10} fill={color}
                  stroke="white" strokeWidth="2"
                  className="transition-all duration-300" />
                <text x={cx} y={cy + 4} textAnchor="middle" fontSize="9" fill="white" fontWeight="bold">
                  {(epic.code || epic.title || '').slice(0, 2).toUpperCase()}
                </text>
                {/* Tooltip label */}
                <text x={cx} y={cy - 15} textAnchor="middle" fontSize="10" fill="#475569">
                  {Math.round(pct)}%
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {epics.map((epic, i) => {
          const pct   = positions[epic.id] ?? 0;
          const color = COLORS[i % COLORS.length];
          const phase = pct < 50 ? 'Descubrimiento' : pct < 90 ? 'Ejecución' : 'Completado';
          return (
            <div key={epic.id}
              onClick={() => isManager && setEditing(prev => prev === epic.id ? null : epic.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all cursor-pointer ${
                editing === epic.id ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 shadow-sm' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-300'
              }`}>
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="font-medium text-slate-700 dark:text-slate-200">{epic.title}</span>
              <span className="text-slate-400">{Math.round(pct)}% · {phase}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
