import { useEffect, useState } from 'react';
import { projectsAPI } from '../../services/projectsAPI';
import { toast } from 'sonner';
import { Sliders, TrendingUp, Calendar, Info } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';

/**
 * WhatIfView (#23) — Proyecciones de velocidad y escenarios what-if
 * Usa AnalyticsController::velocityTrend() para datos reales
 * Permite al usuario simular cambios de velocidad
 */
export default function WhatIfView({ projectId, isManager }) {
  const [velocity, setVelocity]     = useState([]);
  const [backlog, setBacklog]       = useState(0);
  const [loading, setLoading]       = useState(true);
  const [velocityMod, setVelocityMod] = useState(0);   // % change -50 to +100
  const [teamMod, setTeamMod]       = useState(0);     // extra team members

  useEffect(() => {
    Promise.all([
      projectsAPI.getVelocityTrend ? projectsAPI.getVelocityTrend(projectId) : Promise.resolve({ data: [] }),
      projectsAPI.getBacklogItems(projectId),
    ]).then(([vr, br]) => {
      setVelocity(vr.data ?? []);
      const items = br.data ?? [];
      const remaining = items.filter(i => i.status !== 'COMPLETADA')
        .reduce((s, i) => s + (parseInt(i.story_points) || 0), 0);
      setBacklog(remaining);
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  // Average velocity of last 3 sprints
  const recentSprints = velocity.slice(-3);
  const avgVelocity   = recentSprints.length > 0
    ? recentSprints.reduce((s, sp) => s + (parseFloat(sp.velocity ?? sp.completed_points ?? 0)), 0) / recentSprints.length
    : 0;

  // Adjusted velocity with modifiers
  const teamFactor      = 1 + teamMod * 0.15;   // each extra member ~15% boost
  const velocityFactor  = 1 + velocityMod / 100;
  const adjustedVelocity = Math.max(1, avgVelocity * velocityFactor * teamFactor);

  // Sprints to completion
  const sprintsNeeded = adjustedVelocity > 0 ? Math.ceil(backlog / adjustedVelocity) : '∞';

  // Chart data — historical + projected
  const historicalData = velocity.map((sp, i) => ({
    name: sp.sprint_name ?? `Sprint ${i + 1}`,
    real: parseFloat(sp.velocity ?? sp.completed_points ?? 0),
  }));

  const projectedData = Array.from({ length: Math.min(sprintsNeeded === '∞' ? 0 : sprintsNeeded, 8) }, (_, i) => ({
    name: `+${i + 1}`,
    proyectado: Math.round(adjustedVelocity),
    base: Math.round(avgVelocity),
  }));

  const chartData = [
    ...historicalData.map(d => ({ ...d, tipo: 'Histórico' })),
    ...projectedData.map(d => ({ ...d, tipo: 'Proyección' })),
  ];

  if (loading) return <p className="py-10 text-center text-slate-400">Cargando…</p>;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
          <Sliders size={15} className="text-indigo-500" /> Proyecciones What-If
        </h2>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-2 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
        <Info size={12} className="flex-shrink-0" />
        Ajusta los sliders para simular escenarios y ver cómo cambia la fecha estimada de finalización.
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Velocidad promedio', value: avgVelocity.toFixed(1) + ' pts', sub: 'últimos 3 sprints', color: 'bg-indigo-50 dark:bg-indigo-900/20', icon: TrendingUp },
          { label: 'Velocidad ajustada', value: adjustedVelocity.toFixed(1) + ' pts', sub: 'con modificadores', color: 'bg-emerald-50 dark:bg-emerald-900/20', icon: TrendingUp },
          { label: 'Backlog restante', value: backlog + ' pts', sub: 'historias sin completar', color: 'bg-amber-50 dark:bg-amber-900/20', icon: Calendar },
          { label: 'Sprints estimados', value: sprintsNeeded, sub: 'para terminar el backlog', color: 'bg-violet-50 dark:bg-violet-900/20', icon: Calendar },
        ].map(({ label, value, sub, color, icon: Icon }) => (
          <div key={label} className={`${color} rounded-xl p-4`}>
            <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1">{label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Sliders */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
          <Sliders size={12} /> Modificadores del escenario
        </h3>
        <div className="space-y-5">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Cambio en velocidad del equipo
              </label>
              <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${velocityMod > 0 ? 'text-emerald-700 bg-emerald-100' : velocityMod < 0 ? 'text-red-700 bg-red-100' : 'text-slate-600 bg-slate-100'}`}>
                {velocityMod > 0 ? '+' : ''}{velocityMod}%
              </span>
            </div>
            <input type="range" min="-50" max="100" step="5" value={velocityMod}
              onChange={e => setVelocityMod(Number(e.target.value))}
              className="w-full accent-indigo-600" />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>-50%</span><span className="text-slate-300">Sin cambio</span><span>+100%</span>
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Personas adicionales al equipo
              </label>
              <span className="text-sm font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                {teamMod > 0 ? '+' : ''}{teamMod} {teamMod === 1 ? 'persona' : 'personas'}
              </span>
            </div>
            <input type="range" min="0" max="5" step="1" value={teamMod}
              onChange={e => setTeamMod(Number(e.target.value))}
              className="w-full accent-indigo-600" />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>Equipo actual</span><span>+5 personas</span>
            </div>
          </div>
        </div>

        {/* Reset */}
        {(velocityMod !== 0 || teamMod !== 0) && (
          <button onClick={() => { setVelocityMod(0); setTeamMod(0); }}
            className="text-xs text-slate-400 hover:text-indigo-600 hover:underline">
            Restablecer escenario base
          </button>
        )}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4 flex items-center gap-1.5">
            <TrendingUp size={12} /> Velocidad histórica + proyección
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line dataKey="real"       name="Real"        stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} connectNulls />
              <Line dataKey="proyectado" name="Proyectado"  stroke="#10b981" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} connectNulls />
              <Line dataKey="base"       name="Base (sin mod)" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="3 3" dot={false} connectNulls />
              {avgVelocity > 0 && (
                <ReferenceLine y={avgVelocity} stroke="#a5b4fc" strokeDasharray="4 2"
                  label={{ value: 'Promedio', position: 'right', fontSize: 10, fill: '#6366f1' }} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {velocity.length === 0 && (
        <div className="py-8 text-center text-slate-400 text-sm">
          <TrendingUp size={28} className="mx-auto mb-2 opacity-30" />
          <p>Sin historial de velocidad — completa algunos sprints para ver proyecciones</p>
        </div>
      )}
    </div>
  );
}
