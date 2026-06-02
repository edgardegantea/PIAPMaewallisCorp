/**
 * DependencyGraph — SVG-based visual graph of task dependencies.
 *
 * Nodes are laid out in columns by status.
 * Edges are drawn as curved arrows from blocker → blocked task.
 * Click a node to highlight its direct connections.
 */
import { useEffect, useRef, useState } from 'react';
import { projectsAPI } from '../../services/projectsAPI';
import { GitFork, ZoomIn, ZoomOut, Maximize2, RefreshCw } from 'lucide-react';

// ── Constants ────────────────────────────────────────────────────────────────
const NODE_W  = 160;
const NODE_H  = 52;
const H_GAP   = 60;
const V_GAP   = 24;

const STATUS_ORDER  = ['PENDIENTE', 'EN_PROGRESO', 'EN_REVISION', 'BLOQUEADA', 'COMPLETADA'];
const STATUS_LABELS = {
  PENDIENTE:    'Pendiente',
  EN_PROGRESO:  'En progreso',
  EN_REVISION:  'En revisión',
  BLOQUEADA:    'Bloqueada',
  COMPLETADA:   'Completada',
};
const STATUS_COLORS = {
  PENDIENTE:    { bg: '#e0e7ff', border: '#6366f1', text: '#3730a3' },
  EN_PROGRESO:  { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
  EN_REVISION:  { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  BLOQUEADA:    { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
  COMPLETADA:   { bg: '#f1f5f9', border: '#94a3b8', text: '#475569' },
};

const PRIORITY_DOT = { CRITICA: '#ef4444', ALTA: '#f97316', MEDIA: '#eab308', BAJA: '#94a3b8' };

// ── Layout ───────────────────────────────────────────────────────────────────

function layoutNodes(tasks) {
  // Group by status column
  const cols = {};
  STATUS_ORDER.forEach((s) => { cols[s] = []; });
  tasks.forEach((t) => {
    const col = STATUS_ORDER.includes(t.status) ? t.status : 'PENDIENTE';
    cols[col].push(t);
  });

  const nodes = {};
  let colX = 40;

  STATUS_ORDER.forEach((status) => {
    const col = cols[status];
    if (!col.length) return;
    col.forEach((t, rowIdx) => {
      nodes[t.id] = {
        ...t,
        x: colX,
        y: 80 + rowIdx * (NODE_H + V_GAP),
      };
    });
    colX += NODE_W + H_GAP;
  });

  return nodes;
}

// ── SVG arrow (cubic bezier) ─────────────────────────────────────────────────
function Arrow({ x1, y1, x2, y2, color, dash }) {
  const cx1 = x1 + (x2 - x1) * 0.5;
  const cy1 = y1;
  const cx2 = x1 + (x2 - x1) * 0.5;
  const cy2 = y2;
  const d   = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
  return (
    <g>
      <path d={d} fill="none" stroke={color} strokeWidth={1.8}
        strokeDasharray={dash ? '5 3' : undefined} markerEnd={`url(#arrow-${color.replace('#','')})`}
        opacity={0.7} />
    </g>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DependencyGraph({ projectId }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [zoom,    setZoom]    = useState(1);
  const [pan,     setPan]     = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState(null); // selected task id
  const svgRef  = useRef(null);
  const isPanning = useRef(false);
  const lastPan   = useRef({ x: 0, y: 0 });

  const load = () => {
    setLoading(true);
    setError(null);
    projectsAPI.getProjectDependencies(projectId)
      .then((r) => setData(r.data))
      .catch(() => setError('No se pudieron cargar las dependencias.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [projectId]);

  if (loading) return <div className="text-center py-20 text-slate-400">Cargando grafo…</div>;
  if (error)   return <div className="text-center py-16 text-red-400">{error}</div>;

  const { tasks = [], edges = [] } = data;

  if (!tasks.length) {
    return (
      <div className="text-center py-20 text-slate-400">
        <GitFork size={36} className="mx-auto mb-3 opacity-30" />
        <p>No hay tareas en este proyecto.</p>
      </div>
    );
  }

  if (!edges.length) {
    return (
      <div className="text-center py-20 text-slate-400">
        <GitFork size={36} className="mx-auto mb-3 opacity-30" />
        <p>No hay dependencias definidas entre tareas.</p>
        <p className="text-xs mt-1">Añade dependencias desde el detalle de una tarea.</p>
      </div>
    );
  }

  const nodes  = layoutNodes(tasks);
  const nodeIds = Object.keys(nodes).map(Number);

  // SVG canvas size
  const maxX = Math.max(...nodeIds.map((id) => nodes[id].x)) + NODE_W + 40;
  const maxY = Math.max(...nodeIds.map((id) => nodes[id].y)) + NODE_H + 40;

  // Highlighted connections for selected node
  const hlEdges = selected
    ? edges.filter((e) => e.blocker_id === selected || e.task_id === selected)
    : [];
  const hlIds = new Set(hlEdges.flatMap((e) => [e.blocker_id, e.task_id]));

  // Arrow colors
  const arrowColors = ['#6366f1', '#ef4444', '#f59e0b', '#10b981'];
  const colorFor = (e) => e.type === 'RELATED' ? '#94a3b8' : '#6366f1';

  // Drag pan
  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    isPanning.current = true;
    lastPan.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };
  const onMouseMove = (e) => {
    if (!isPanning.current) return;
    setPan({ x: e.clientX - lastPan.current.x, y: e.clientY - lastPan.current.y });
  };
  const onMouseUp = () => { isPanning.current = false; };

  // Unique arrow marker colors
  const markerColors = ['6366f1', 'ef4444', '94a3b8'];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3 flex-wrap">
        <GitFork size={18} className="text-indigo-500" />
        <h3 className="font-semibold text-slate-700 dark:text-slate-200">Grafo de Dependencias</h3>
        <span className="text-xs text-slate-400">{tasks.length} tareas · {edges.length} dependencias</span>
        {selected && (
          <button onClick={() => setSelected(null)}
            className="text-xs text-indigo-600 hover:underline ml-2">
            Limpiar selección
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={load} title="Recargar" className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <RefreshCw size={15} />
          </button>
          <button onClick={() => setZoom((z) => Math.max(0.3, z - 0.15))}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><ZoomOut size={15} /></button>
          <span className="text-xs text-slate-400 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(2, z + 0.15))}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><ZoomIn size={15} /></button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" title="Resetear vista">
            <Maximize2 size={15} />
          </button>
        </div>
      </div>

      {/* Status column headers */}
      <div className="flex gap-0 px-5 pt-3 pb-1 overflow-x-auto">
        {STATUS_ORDER.map((s) => {
          const count = tasks.filter((t) => t.status === s).length;
          if (!count) return null;
          const c = STATUS_COLORS[s];
          return (
            <div key={s} className="flex-shrink-0 text-center"
              style={{ width: NODE_W + H_GAP, marginLeft: 0 }}>
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                {STATUS_LABELS[s]} <span className="opacity-60">({count})</span>
              </span>
            </div>
          );
        })}
      </div>

      {/* SVG canvas */}
      <div
        className="overflow-hidden cursor-grab active:cursor-grabbing"
        style={{ height: Math.min(600, maxY * zoom + 60) }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <svg
          ref={svgRef}
          width={maxX * zoom}
          height={maxY * zoom}
          style={{ transform: `translate(${pan.x}px, ${pan.y}px)`, transformOrigin: '0 0' }}
        >
          {/* Arrow marker defs */}
          <defs>
            {['6366f1', 'ef4444', '94a3b8'].map((hex) => (
              <marker key={hex} id={`arrow-${hex}`} markerWidth="8" markerHeight="8"
                refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill={`#${hex}`} opacity="0.8" />
              </marker>
            ))}
          </defs>

          <g transform={`scale(${zoom})`}>
            {/* Edges */}
            {edges.map((e, i) => {
              const from = nodes[e.blocker_id];
              const to   = nodes[e.task_id];
              if (!from || !to) return null;

              const isHL  = hlEdges.some((h) => h.id === e.id);
              const faded = selected && !isHL;
              const color = e.type === 'RELATED' ? '#94a3b8' : '#6366f1';
              const x1 = from.x + NODE_W;
              const y1 = from.y + NODE_H / 2;
              const x2 = to.x;
              const y2 = to.y + NODE_H / 2;

              return (
                <g key={e.id} opacity={faded ? 0.15 : 1}>
                  <Arrow x1={x1} y1={y1} x2={x2} y2={y2}
                    color={color} dash={e.type === 'RELATED'} />
                </g>
              );
            })}

            {/* Nodes */}
            {nodeIds.map((id) => {
              const n      = nodes[id];
              const c      = STATUS_COLORS[n.status] ?? STATUS_COLORS.PENDIENTE;
              const isSelected = selected === id;
              const faded  = selected && !isSelected && !hlIds.has(id);
              const dotCol = PRIORITY_DOT[n.priority] || '#94a3b8';

              return (
                <g key={id}
                  transform={`translate(${n.x},${n.y})`}
                  opacity={faded ? 0.2 : 1}
                  onClick={() => setSelected((s) => s === id ? null : id)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Shadow */}
                  <rect x={2} y={3} width={NODE_W} height={NODE_H} rx={8}
                    fill="rgba(0,0,0,0.08)" />
                  {/* Box */}
                  <rect x={0} y={0} width={NODE_W} height={NODE_H} rx={8}
                    fill={c.bg}
                    stroke={isSelected ? '#6366f1' : c.border}
                    strokeWidth={isSelected ? 2.5 : 1.5} />
                  {/* Priority dot */}
                  <circle cx={12} cy={14} r={4} fill={dotCol} />
                  {/* Title */}
                  <foreignObject x={20} y={6} width={NODE_W - 26} height={24}>
                    <div xmlns="http://www.w3.org/1999/xhtml"
                      style={{
                        fontSize: 11, fontWeight: 600, color: c.text,
                        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                        lineHeight: '22px',
                      }}>
                      {n.title}
                    </div>
                  </foreignObject>
                  {/* Sprint name */}
                  <foreignObject x={8} y={30} width={NODE_W - 16} height={18}>
                    <div xmlns="http://www.w3.org/1999/xhtml"
                      style={{ fontSize: 10, color: c.text, opacity: 0.65, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {n.sprint_name}
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Legend */}
      <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <svg width="20" height="8"><path d="M0,4 L14,4" stroke="#6366f1" strokeWidth="2" markerEnd="url(#leg-arrow)" /><defs><marker id="leg-arrow" markerWidth="6" markerHeight="6" refX="5" refY="2" orient="auto"><path d="M0,0 L0,4 L6,2 z" fill="#6366f1" /></marker></defs></svg>
          Bloquea
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="20" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 2" /></svg>
          Relacionada
        </span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Crítica</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> Alta</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Media</span>
        <span className="flex items-center gap-1.5 ml-auto text-slate-400 italic">Click en nodo para resaltar conexiones · Drag para mover · Scroll para zoom</span>
      </div>
    </div>
  );
}
