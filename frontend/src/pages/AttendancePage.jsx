import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  MapPin, LogIn, LogOut, Clock, CheckCircle2, XCircle,
  AlertTriangle, RefreshCw, Navigation, Pencil, X, Save,
  Users, Filter, Plus, Trash2, Download, ChevronDown, ChevronUp,
  UserCheck, UserX, Activity, TrendingUp, Eye, Calendar,
  FileText, Settings, CalendarDays, ChevronLeft, ChevronRight,
  Sun, Moon, Briefcase, HeartPulse, MoreHorizontal,
} from 'lucide-react';
import { attendanceAPI, scheduleAPI, leaveAPI } from '../services/attendanceAPI';
import { useAuthStore } from '../stores/authStore';
import Layout from '../components/Layout';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtDuration(inAt, outAt) {
  const from = new Date(inAt);
  const to   = outAt ? new Date(outAt) : new Date();
  const sec  = Math.floor((to - from) / 1000);
  if (sec < 0) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function fmtTime(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function displayName(r) {
  if (r.first_name || r.last_name) return `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim();
  return r.user_name ?? r.username ?? r.email ?? `#${r.user_id}`;
}
function initials(r) {
  const n = displayName(r);
  const parts = n.split(' ');
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
}

const AVATAR_COLORS = [
  'bg-indigo-500','bg-violet-500','bg-blue-500','bg-emerald-500',
  'bg-amber-500','bg-rose-500','bg-teal-500','bg-cyan-500',
];
function avatarColor(id) { return AVATAR_COLORS[(id ?? 0) % AVATAR_COLORS.length]; }

function exportCSV(rows) {
  const cols = ['ID','Usuario','Email','Ubicación','Entrada','Salida','Duración','GPS Entrada','GPS Salida','Estado','Notas'];
  const lines = [cols.join(',')];
  rows.forEach(r => {
    const dur    = r.check_out_at ? fmtDuration(r.check_in_at, r.check_out_at) : 'Activo';
    const geoIn  = r.check_in_lat  != null ? (r.check_in_valid  ? 'OK' : 'FUERA') : 'Sin GPS';
    const geoOut = r.check_out_lat != null ? (r.check_out_valid ? 'OK' : 'FUERA') : '—';
    lines.push([
      r.id, `"${displayName(r)}"`, r.user_email ?? '', `"${r.location_name ?? ''}"`,
      r.check_in_at, r.check_out_at ?? '', dur, geoIn, geoOut,
      r.status, `"${(r.notes ?? '').replace(/"/g, '""')}"`,
    ].join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `asistencia_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

// ─────────────────────────────────────────────────────────────────────────────
// GeoBadge
// ─────────────────────────────────────────────────────────────────────────────

function GeoBadge({ valid, distM, noGps }) {
  if (noGps) return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-400">
      <AlertTriangle size={11}/> Sin GPS
    </span>
  );
  if (valid) return (
    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
      <CheckCircle2 size={11}/> {distM}m — dentro del área
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs text-red-500">
      <XCircle size={11}/> {distM}m — fuera del área
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat card
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color }) {
  const styles = {
    indigo:  { bg: 'bg-indigo-50 dark:bg-indigo-900/20',  text: 'text-indigo-600 dark:text-indigo-400'  },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20',text: 'text-emerald-600 dark:text-emerald-400'},
    amber:   { bg: 'bg-amber-50 dark:bg-amber-900/20',    text: 'text-amber-600 dark:text-amber-400'    },
    red:     { bg: 'bg-red-50 dark:bg-red-900/20',        text: 'text-red-500 dark:text-red-400'        },
  };
  const s = styles[color] ?? styles.indigo;
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 flex items-center gap-4">
      <div className={`p-3 rounded-xl ${s.bg} ${s.text} flex-shrink-0`}>
        <Icon size={20}/>
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value ?? '—'}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Location modal
// ─────────────────────────────────────────────────────────────────────────────

function LocationModal({ loc, onClose, onSaved }) {
  const isNew = !loc?.id;
  const [form, setForm] = useState({
    name:      loc?.name      ?? '',
    address:   loc?.address   ?? '',
    latitude:  loc?.latitude  ?? '',
    longitude: loc?.longitude ?? '',
    radius_m:  loc?.radius_m  ?? 100,
    is_active: loc?.is_active !== undefined ? Number(loc.is_active) : 1,
  });
  const [picking, setPicking] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const detectGPS = () => {
    if (!navigator.geolocation) { toast.error('GPS no disponible'); return; }
    setPicking(true);
    navigator.geolocation.getCurrentPosition(
      pos => { set('latitude', pos.coords.latitude.toFixed(7)); set('longitude', pos.coords.longitude.toFixed(7)); setPicking(false); toast.success('Coordenadas capturadas'); },
      ()  => { toast.error('No se pudo obtener la ubicación'); setPicking(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const submit = async e => {
    e.preventDefault();
    if (!form.latitude || !form.longitude) { toast.error('Latitud y longitud son obligatorias'); return; }
    setSaving(true);
    try {
      isNew ? await attendanceAPI.createLocation(form) : await attendanceAPI.updateLocation(loc.id, form);
      toast.success(isNew ? 'Ubicación creada' : 'Ubicación actualizada');
      onSaved();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const mapsUrl = form.latitude && form.longitude
    ? `https://www.openstreetmap.org/?mlat=${form.latitude}&mlon=${form.longitude}&zoom=16`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg my-4 border border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-indigo-500"/>
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">{isNew ? 'Nueva ubicación' : 'Editar ubicación'}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={18}/></button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">Nombre *</label>
            <input className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.name} onChange={e => set('name', e.target.value)} required placeholder="Ej. Oficina Central" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">Dirección</label>
            <input className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.address} onChange={e => set('address', e.target.value)} placeholder="Calle, ciudad (opcional)" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">Latitud *</label>
              <input className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm font-mono bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                type="number" step="any" value={form.latitude} onChange={e => set('latitude', e.target.value)} placeholder="19.432608" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">Longitud *</label>
              <input className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm font-mono bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                type="number" step="any" value={form.longitude} onChange={e => set('longitude', e.target.value)} placeholder="-99.133209" required />
            </div>
          </div>
          <button type="button" onClick={detectGPS} disabled={picking}
            className="w-full flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-600 rounded-xl py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <Navigation size={14} className={picking ? 'animate-pulse text-indigo-500' : ''}/>
            {picking ? 'Detectando ubicación...' : 'Usar mi ubicación actual (GPS)'}
          </button>
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-indigo-500 hover:underline">
              <Eye size={11}/> Verificar en OpenStreetMap
            </a>
          )}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Radio permitido</label>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{form.radius_m}m</span>
            </div>
            <input type="range" min={10} max={1000} step={10} value={form.radius_m}
              onChange={e => set('radius_m', e.target.value)} className="w-full accent-indigo-500"/>
            <div className="flex justify-between text-xs text-slate-400 mt-1"><span>10m</span><span>1000m</span></div>
          </div>
          <button type="button" onClick={() => set('is_active', form.is_active ? 0 : 1)}
            className="flex items-center gap-3 w-full">
            <div className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${form.is_active ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`}/>
            </div>
            <span className="text-sm text-slate-600 dark:text-slate-300">{form.is_active ? 'Ubicación activa' : 'Ubicación inactiva'}</span>
          </button>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
              <Save size={14}/> {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Record modal (create / edit — admin)
// ─────────────────────────────────────────────────────────────────────────────

function RecordModal({ record, users, locations, onClose, onSaved }) {
  const isNew = !record?.id;
  const toLocal = dt => dt ? new Date(new Date(dt) - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16) : '';
  const [form, setForm] = useState({
    user_id:      record?.user_id      ?? '',
    location_id:  record?.location_id  ?? '',
    check_in_at:  toLocal(record?.check_in_at),
    check_out_at: toLocal(record?.check_out_at),
    notes:        record?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async e => {
    e.preventDefault();
    if (!form.user_id || !form.check_in_at) { toast.error('Usuario y hora de entrada son obligatorios'); return; }
    setSaving(true);
    try {
      isNew ? await attendanceAPI.createRecord(form) : await attendanceAPI.updateRecord(record.id, form);
      toast.success(isNew ? 'Registro creado' : 'Registro actualizado');
      onSaved();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const inp = 'w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-indigo-500"/>
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">
              {isNew ? 'Crear registro manual' : `Editar registro #${record.id}`}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={18}/></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">Usuario *</label>
            <select className={inp} value={form.user_id} onChange={e => set('user_id', e.target.value)} required>
              <option value="">— Selecciona un usuario —</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.first_name ? `${u.first_name} ${u.last_name}` : u.username} ({u.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">Ubicación</label>
            <select className={inp} value={form.location_id} onChange={e => set('location_id', e.target.value)}>
              <option value="">— Sin ubicación —</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">Entrada *</label>
              <input className={inp} type="datetime-local" value={form.check_in_at} onChange={e => set('check_in_at', e.target.value)} required/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">Salida</label>
              <input className={inp} type="datetime-local" value={form.check_out_at} onChange={e => set('check_out_at', e.target.value)}/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">Notas</label>
            <textarea className={`${inp} h-20 resize-none`} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Justificación u observaciones..."/>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
              <Save size={14}/> {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Present card
// ─────────────────────────────────────────────────────────────────────────────

function PresentCard({ record }) {
  const [elapsed, setElapsed] = useState(fmtDuration(record.check_in_at, null));
  useEffect(() => {
    const id = setInterval(() => setElapsed(fmtDuration(record.check_in_at, null)), 30000);
    return () => clearInterval(id);
  }, [record.check_in_at]);

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800">
      <div className={`w-8 h-8 rounded-full ${avatarColor(record.user_id)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
        {initials(record).toUpperCase() || '?'}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{displayName(record)}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {record.location_name ?? 'Sin ubicación'} · desde {fmtTime(record.check_in_at)} <span className="font-medium text-emerald-600 dark:text-emerald-400">({elapsed})</span>
        </p>
      </div>
      <GeoBadge valid={!!record.check_in_valid} distM={record.check_in_dist_m} noGps={record.check_in_lat == null}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Record row
// ─────────────────────────────────────────────────────────────────────────────

function RecordRow({ record: r, showUser, onEdit, onDelete }) {
  const [exp, setExp] = useState(false);

  const statusBadge = {
    open:   <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>Activo</span>,
    closed: <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">Cerrado</span>,
    manual: <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">Manual</span>,
  }[r.status] ?? null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
      <button onClick={() => setExp(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
        <div className={`w-8 h-8 rounded-full ${avatarColor(r.user_id)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
          {initials(r).toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          {showUser && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{displayName(r)}</p>}
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
            {fmtDate(r.check_in_at)} · {r.location_name ?? <span className="text-slate-400">Sin ubicación</span>}
          </p>
          <p className="text-xs text-slate-400">
            {fmtTime(r.check_in_at)} → {r.check_out_at ? fmtTime(r.check_out_at) : '…'} &nbsp;·&nbsp;
            <span className="font-medium text-slate-500 dark:text-slate-300">{fmtDuration(r.check_in_at, r.check_out_at)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {statusBadge}
          {exp ? <ChevronUp size={14} className="text-slate-400"/> : <ChevronDown size={14} className="text-slate-400"/>}
        </div>
      </button>

      {exp && (
        <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700 pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Entrada</p>
              <p className="text-slate-700 dark:text-slate-200">{fmtDateTime(r.check_in_at)}</p>
              <GeoBadge valid={!!r.check_in_valid} distM={r.check_in_dist_m} noGps={r.check_in_lat == null}/>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Salida</p>
              {r.check_out_at
                ? <><p className="text-slate-700 dark:text-slate-200">{fmtDateTime(r.check_out_at)}</p><GeoBadge valid={!!r.check_out_valid} distM={r.check_out_dist_m} noGps={r.check_out_lat == null}/></>
                : <p className="text-slate-400">—</p>}
            </div>
          </div>
          {r.notes && (
            <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2">{r.notes}</p>
          )}
          {(onEdit || onDelete) && (
            <div className="flex gap-2">
              {onEdit && (
                <button onClick={() => onEdit(r)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <Pencil size={11}/> Editar
                </button>
              )}
              {onDelete && (
                <button onClick={() => onDelete(r)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  <Trash2 size={11}/> Eliminar
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function AttendancePage() {
  const { user } = useAuthStore();
  const isAdmin  = user?.role === 'admin' || user?.role === 'ADMIN';

  const [tab, setTab] = useState(isAdmin ? 'dashboard' : 'mi-asistencia');

  // User check-in
  const [status,        setStatus]        = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [selectedLoc,   setSelectedLoc]   = useState('');
  const [actioning,     setActioning]     = useState(false);
  const [geoCoords,     setGeoCoords]     = useState(null);
  const [geoError,      setGeoError]      = useState(null);
  const [geoLoading,    setGeoLoading]    = useState(false);

  // My records
  const [myRecords, setMyRecords] = useState([]);
  const [loadingMy, setLoadingMy] = useState(false);

  // Admin dashboard
  const [todayData,    setTodayData]    = useState(null);
  const [loadingToday, setLoadingToday] = useState(false);

  // Admin records
  const [records,      setRecords]      = useState([]);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [loadingRec,   setLoadingRec]   = useState(false);
  const [recPage,      setRecPage]      = useState(0);
  const [filters, setFilters] = useState({ user_id:'', location_id:'', date_from:'', date_to:'', status:'', geo_valid:'' });
  const [usersList,    setUsersList]    = useState([]);
  const [editRecord,   setEditRecord]   = useState(null);
  const [showRecModal, setShowRecModal] = useState(false);

  // Admin locations
  const [locations,    setLocations]    = useState([]);
  const [loadingLocs,  setLoadingLocs]  = useState(false);
  const [editLoc,      setEditLoc]      = useState(null);
  const [showLocModal, setShowLocModal] = useState(false);

  // ── Permisos ──────────────────────────────────────────────────────────────
  const [myLeaves,      setMyLeaves]      = useState([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const [allLeaves,     setAllLeaves]     = useState([]);
  const [loadingAllL,   setLoadingAllL]   = useState(false);
  const [leaveFilters,  setLeaveFilters]  = useState({ status: '', type: '', user_id: '' });
  const [showLeaveForm, setShowLeaveForm] = useState(false);

  // ── Horario ───────────────────────────────────────────────────────────────
  const [schedule,       setSchedule]       = useState(null);
  const [loadingSchedule,setLoadingSchedule]= useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [selectedSchUser,setSelectedSchUser]= useState('');

  // ── Reporte ───────────────────────────────────────────────────────────────
  const [reportData,    setReportData]    = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportYear,    setReportYear]    = useState(new Date().getFullYear());
  const [reportMonth,   setReportMonth]   = useState(new Date().getMonth() + 1);
  const [reportUser,    setReportUser]    = useState('');

  // Loaders
  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const { data } = await attendanceAPI.status();
      setStatus(data);
      if (!selectedLoc && data.locations?.length === 1) setSelectedLoc(String(data.locations[0].id));
    } catch { toast.error('Error al cargar estado de asistencia'); }
    finally { setLoadingStatus(false); }
  }, []);

  const loadMyRecords = useCallback(async () => {
    setLoadingMy(true);
    try { const { data } = await attendanceAPI.myRecords({ limit: 60 }); setMyRecords(data); }
    catch { toast.error('Error al cargar historial'); }
    finally { setLoadingMy(false); }
  }, []);

  const loadToday = useCallback(async () => {
    setLoadingToday(true);
    try { const { data } = await attendanceAPI.today(); setTodayData(data); }
    catch { toast.error('Error al cargar datos de hoy'); }
    finally { setLoadingToday(false); }
  }, []);

  const loadRecords = useCallback(async (pg = 0) => {
    setLoadingRec(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([,v]) => v !== ''));
      const { data } = await attendanceAPI.allRecords({ ...params, limit: PAGE_SIZE, offset: pg * PAGE_SIZE });
      setRecords(data.data ?? []); setRecordsTotal(data.total ?? 0); setRecPage(pg);
    } catch { toast.error('Error al cargar registros'); }
    finally { setLoadingRec(false); }
  }, [filters]);

  const loadLocations = useCallback(async () => {
    setLoadingLocs(true);
    try { const { data } = await attendanceAPI.getLocations(); setLocations(data); }
    catch { toast.error('Error al cargar ubicaciones'); }
    finally { setLoadingLocs(false); }
  }, []);

  const loadUsers = useCallback(async () => {
    try { const { data } = await attendanceAPI.usersList(); setUsersList(data); } catch {}
  }, []);

  const loadMyLeaves = useCallback(async () => {
    setLoadingLeaves(true);
    try { const { data } = await leaveAPI.my(); setMyLeaves(data); }
    catch { toast.error('Error al cargar solicitudes'); }
    finally { setLoadingLeaves(false); }
  }, []);

  const loadAllLeaves = useCallback(async () => {
    setLoadingAllL(true);
    try {
      const params = Object.fromEntries(Object.entries(leaveFilters).filter(([,v]) => v !== ''));
      const { data } = await leaveAPI.all(params);
      setAllLeaves(data);
    } catch { toast.error('Error al cargar solicitudes'); }
    finally { setLoadingAllL(false); }
  }, [leaveFilters]);

  const loadSchedule = useCallback(async (uid = '') => {
    setLoadingSchedule(true);
    try {
      const { data } = uid ? await scheduleAPI.getForUser(uid) : await scheduleAPI.getDefault();
      setSchedule(data);
    } catch { toast.error('Error al cargar horario'); }
    finally { setLoadingSchedule(false); }
  }, []);

  const loadReport = useCallback(async () => {
    setLoadingReport(true);
    try {
      const params = { year: reportYear, month: reportMonth };
      if (reportUser) params.user_id = reportUser;
      const { data } = await attendanceAPI.report(params);
      setReportData(data);
    } catch { toast.error('Error al generar reporte'); }
    finally { setLoadingReport(false); }
  }, [reportYear, reportMonth, reportUser]);

  useEffect(() => { loadStatus(); loadMyRecords(); loadMyLeaves(); }, []);
  useEffect(() => {
    if (!isAdmin) return;
    if (tab === 'dashboard')   { loadToday(); }
    if (tab === 'registros')   { loadRecords(0); loadUsers(); loadLocations(); }
    if (tab === 'ubicaciones') { loadLocations(); }
    if (tab === 'permisos')    { loadAllLeaves(); loadUsers(); }
    if (tab === 'horario')     { loadSchedule(''); loadUsers(); }
    if (tab === 'reporte')     { loadReport(); loadUsers(); }
  }, [tab, isAdmin]);

  // GPS
  const getGPS = () => new Promise(resolve => {
    if (!navigator.geolocation) { resolve(null); return; }
    setGeoLoading(true); setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      pos => { const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude }; setGeoCoords(c); setGeoLoading(false); resolve(c); },
      ()  => { setGeoError('GPS no disponible — registro guardado sin validación geográfica.'); setGeoLoading(false); resolve(null); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

  const handleCheckIn = async () => {
    if (!selectedLoc) { toast.error('Selecciona una ubicación'); return; }
    setActioning(true);
    const coords = await getGPS();
    try {
      const { data } = await attendanceAPI.checkIn({ location_id: parseInt(selectedLoc), ...coords });
      if (data.geo_valid)           toast.success(`Entrada registrada ✓ — ${data.distance_m}m del centro`);
      else if (data.distance_m != null) toast.warning(`Entrada registrada — fuera del área (${data.distance_m}m)`);
      else                              toast.info('Entrada registrada sin verificación GPS');
      loadStatus(); loadMyRecords();
      if (isAdmin && tab === 'dashboard') loadToday();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Error al registrar entrada'); }
    finally { setActioning(false); }
  };

  const handleCheckOut = async () => {
    setActioning(true);
    const coords = await getGPS();
    try {
      const { data } = await attendanceAPI.checkOut(coords ?? {});
      if (data.geo_valid)           toast.success(`Salida registrada ✓ — ${data.distance_m}m del centro`);
      else if (data.distance_m != null) toast.warning(`Salida registrada — fuera del área (${data.distance_m}m)`);
      else                              toast.info('Salida registrada sin verificación GPS');
      loadStatus(); loadMyRecords();
      if (isAdmin && tab === 'dashboard') loadToday();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Error al registrar salida'); }
    finally { setActioning(false); }
  };

  const handleDeleteRecord = async r => {
    if (!confirm(`¿Eliminar el registro #${r.id} de ${displayName(r)}?`)) return;
    try { await attendanceAPI.deleteRecord(r.id); toast.success('Registro eliminado'); loadRecords(recPage); if (tab === 'dashboard') loadToday(); }
    catch { toast.error('Error al eliminar'); }
  };

  const handleDeleteLoc = async loc => {
    if (!confirm(`¿Eliminar la ubicación "${loc.name}"?`)) return;
    try { await attendanceAPI.deleteLocation(loc.id); toast.success('Ubicación eliminada'); loadLocations(); loadStatus(); }
    catch (err) { toast.error(err.response?.data?.message ?? 'Error al eliminar'); }
  };

  const open = status?.open;
  const inp  = 'border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400';

  // ── Leave request handlers ────────────────────────────────────────────────

  const handleApproveLeave = async (id) => {
    try { await leaveAPI.approve(id, {}); toast.success('Solicitud aprobada'); loadAllLeaves(); }
    catch (err) { toast.error(err.response?.data?.message ?? 'Error'); }
  };
  const handleRejectLeave = async (id) => {
    const notes = prompt('Motivo del rechazo (opcional):') ?? '';
    try { await leaveAPI.reject(id, { notes }); toast.success('Solicitud rechazada'); loadAllLeaves(); }
    catch (err) { toast.error(err.response?.data?.message ?? 'Error'); }
  };
  const handleCancelLeave = async (id) => {
    if (!confirm('¿Cancelar esta solicitud?')) return;
    try { await leaveAPI.cancel(id); toast.success('Solicitud cancelada'); loadMyLeaves(); }
    catch (err) { toast.error(err.response?.data?.message ?? 'Error'); }
  };

  const tabItems = [
    { key: 'mi-asistencia', label: 'Mi asistencia', icon: Clock },
    ...(!isAdmin ? [{ key: 'mis-permisos', label: 'Mis permisos', icon: CalendarDays }] : []),
    ...(isAdmin ? [
      { key: 'dashboard',   label: 'Dashboard',     icon: Activity  },
      { key: 'registros',   label: 'Registros',     icon: Users     },
      { key: 'permisos',    label: 'Permisos',      icon: CalendarDays },
      { key: 'reporte',     label: 'Reporte',       icon: FileText  },
      { key: 'horario',     label: 'Horarios',      icon: Settings  },
      { key: 'ubicaciones', label: 'Ubicaciones',   icon: MapPin    },
    ] : []),
  ];

  return (
    <Layout>
      <div className="px-6 py-6 space-y-6 min-h-full">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
              <MapPin className="text-indigo-600 dark:text-indigo-400" size={20}/>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Asistencia</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Control de entrada y salida con geolocalización</p>
            </div>
          </div>
          <button onClick={() => { loadStatus(); if (tab==='dashboard') loadToday(); if (tab==='registros') loadRecords(recPage); if (tab==='ubicaciones') loadLocations(); }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors">
            <RefreshCw size={14}/> Actualizar
          </button>
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────────── */}
        <div className="flex gap-0.5 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
          {tabItems.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors -mb-px
                ${tab === key
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
              <Icon size={14}/> {label}
            </button>
          ))}
        </div>

        {/* ── TAB: Mi asistencia ───────────────────────────────────────── */}
        {tab === 'mi-asistencia' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Check-in card */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 space-y-4">
                <h2 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Clock size={16} className="text-indigo-500"/> Estado actual
                </h2>

                {loadingStatus ? (
                  <p className="text-sm text-slate-400 animate-pulse">Cargando...</p>
                ) : open ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"/>
                      <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Sesión activa</span>
                    </div>
                    <dl className="space-y-2.5 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Ubicación</dt>
                        <dd className="font-medium text-slate-800 dark:text-slate-100">{open.location_name ?? '—'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Entrada</dt>
                        <dd className="font-medium text-slate-800 dark:text-slate-100">{fmtTime(open.check_in_at)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Duración</dt>
                        <dd className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">{fmtDuration(open.check_in_at, null)}</dd>
                      </div>
                      <div className="flex justify-between items-center">
                        <dt className="text-slate-500">GPS entrada</dt>
                        <dd><GeoBadge valid={!!open.check_in_valid} distM={open.check_in_dist_m} noGps={open.check_in_lat == null}/></dd>
                      </div>
                    </dl>
                    <button onClick={handleCheckOut} disabled={actioning || geoLoading}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-60">
                      <LogOut size={15}/> {actioning ? 'Registrando...' : 'Registrar Salida'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-400 flex-shrink-0"/>
                      <span className="text-sm text-slate-500 dark:text-slate-400">Sin sesión activa</span>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">Ubicación de trabajo *</label>
                      <select className={`${inp} w-full`} value={selectedLoc} onChange={e => setSelectedLoc(e.target.value)}>
                        <option value="">— Selecciona una ubicación —</option>
                        {(status?.locations ?? []).map(l => (
                          <option key={l.id} value={l.id}>{l.name}{l.address ? ` · ${l.address}` : ''}</option>
                        ))}
                      </select>
                    </div>
                    <button onClick={handleCheckIn} disabled={actioning || geoLoading || !selectedLoc}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-60">
                      <LogIn size={15}/> {actioning ? 'Registrando...' : 'Registrar Entrada'}
                    </button>
                  </div>
                )}

                {geoLoading && (
                  <p className="text-xs text-indigo-500 flex items-center gap-1.5">
                    <Navigation size={11} className="animate-pulse"/> Obteniendo GPS...
                  </p>
                )}
                {geoError && (
                  <p className="text-xs text-amber-500 flex items-center gap-1.5">
                    <AlertTriangle size={11}/> {geoError}
                  </p>
                )}
              </div>
            </div>

            {/* My history */}
            <div className="lg:col-span-2 space-y-3">
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">Mi historial</h2>
              {loadingMy ? (
                <p className="text-sm text-slate-400 animate-pulse">Cargando...</p>
              ) : myRecords.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-10 text-center">
                  <Clock size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-2"/>
                  <p className="text-slate-500 text-sm">Sin registros aún.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {myRecords.map(r => <RecordRow key={r.id} record={r} showUser={false}/>)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: Dashboard ───────────────────────────────────────────── */}
        {tab === 'dashboard' && isAdmin && (
          <div className="space-y-6">
            {loadingToday ? (
              <p className="text-sm text-slate-400 animate-pulse">Cargando datos de hoy...</p>
            ) : todayData ? (
              <>
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                  <StatCard icon={UserCheck}     label="Presentes ahora"   value={todayData.stats.present_now}    color="emerald"/>
                  <StatCard icon={Calendar}      label="Registros hoy"     value={todayData.stats.total_today}    color="indigo"/>
                  <StatCard icon={TrendingUp}    label="Promedio de horas" value={todayData.stats.avg_hours_today != null ? `${todayData.stats.avg_hours_today}h` : '—'} color="amber"/>
                  <StatCard icon={AlertTriangle} label="Violaciones GPS"   value={todayData.stats.geo_violations} color="red"/>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <h2 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <UserCheck size={16} className="text-emerald-500"/>
                      Presentes ahora
                      <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                        {todayData.present?.length ?? 0}
                      </span>
                    </h2>
                  </div>
                  <div className="p-4">
                    {todayData.present?.length === 0 ? (
                      <div className="text-center py-8">
                        <UserX size={28} className="text-slate-300 dark:text-slate-600 mx-auto mb-2"/>
                        <p className="text-sm text-slate-400">Nadie está actualmente registrado</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {todayData.present.map(r => <PresentCard key={r.id} record={r}/>)}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* ── TAB: Todos los registros ─────────────────────────────────── */}
        {tab === 'registros' && isAdmin && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 px-6 py-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Usuario</label>
                  <select className={inp} value={filters.user_id} onChange={e => setFilters(f => ({...f, user_id: e.target.value}))}>
                    <option value="">Todos</option>
                    {usersList.map(u => <option key={u.id} value={u.id}>{u.first_name ? `${u.first_name} ${u.last_name}` : u.username}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Ubicación</label>
                  <select className={inp} value={filters.location_id} onChange={e => setFilters(f => ({...f, location_id: e.target.value}))}>
                    <option value="">Todas</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Desde</label>
                  <input className={inp} type="date" value={filters.date_from} onChange={e => setFilters(f => ({...f, date_from: e.target.value}))}/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Hasta</label>
                  <input className={inp} type="date" value={filters.date_to} onChange={e => setFilters(f => ({...f, date_to: e.target.value}))}/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Estado</label>
                  <select className={inp} value={filters.status} onChange={e => setFilters(f => ({...f, status: e.target.value}))}>
                    <option value="">Todos</option>
                    <option value="open">Activo</option>
                    <option value="closed">Cerrado</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">GPS</label>
                  <select className={inp} value={filters.geo_valid} onChange={e => setFilters(f => ({...f, geo_valid: e.target.value}))}>
                    <option value="">Todos</option>
                    <option value="1">Válido</option>
                    <option value="0">Inválido / Sin GPS</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => loadRecords(0)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
                    <Filter size={13}/> Filtrar
                  </button>
                  <button onClick={() => setFilters({ user_id:'', location_id:'', date_from:'', date_to:'', status:'', geo_valid:'' })}
                    className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    Limpiar
                  </button>
                </div>
              </div>
            </div>

            {/* Actions bar */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-200">{recordsTotal}</span> registro{recordsTotal !== 1 ? 's' : ''} encontrado{recordsTotal !== 1 ? 's' : ''}
              </p>
              <div className="flex gap-2">
                <button onClick={() => { setEditRecord({}); setShowRecModal(true); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
                  <Plus size={14}/> Registro manual
                </button>
                <button onClick={() => exportCSV(records)} disabled={records.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors disabled:opacity-40">
                  <Download size={14}/> Exportar CSV
                </button>
              </div>
            </div>

            {loadingRec ? (
              <p className="text-sm text-slate-400 animate-pulse">Cargando registros...</p>
            ) : records.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-10 text-center">
                <Clock size={28} className="text-slate-300 dark:text-slate-600 mx-auto mb-2"/>
                <p className="text-slate-500 text-sm">Sin registros para los filtros aplicados.</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {records.map(r => (
                    <RecordRow key={r.id} record={r} showUser
                      onEdit={() => { setEditRecord(r); setShowRecModal(true); }}
                      onDelete={handleDeleteRecord}
                    />
                  ))}
                </div>
                {recordsTotal > PAGE_SIZE && (
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button disabled={recPage === 0} onClick={() => loadRecords(recPage - 1)}
                      className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 transition-colors">
                      ← Anterior
                    </button>
                    <span className="text-sm text-slate-500">
                      Página <span className="font-semibold text-slate-700 dark:text-slate-200">{recPage + 1}</span> de {Math.ceil(recordsTotal / PAGE_SIZE)}
                    </span>
                    <button disabled={(recPage + 1) * PAGE_SIZE >= recordsTotal} onClick={() => loadRecords(recPage + 1)}
                      className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 transition-colors">
                      Siguiente →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── TAB: Ubicaciones ─────────────────────────────────────────── */}
        {tab === 'ubicaciones' && isAdmin && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-200">{locations.length}</span> ubicación{locations.length !== 1 ? 'es' : ''} configurada{locations.length !== 1 ? 's' : ''}
              </p>
              <button onClick={() => { setEditLoc({}); setShowLocModal(true); }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
                <Plus size={14}/> Nueva ubicación
              </button>
            </div>

            {loadingLocs ? (
              <p className="text-sm text-slate-400 animate-pulse">Cargando...</p>
            ) : locations.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-12 text-center">
                <MapPin size={36} className="text-slate-300 dark:text-slate-600 mx-auto mb-3"/>
                <p className="font-medium text-slate-500 mb-1">No hay ubicaciones configuradas</p>
                <p className="text-sm text-slate-400">Agrega la primera ubicación usando el botón de arriba.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {locations.map(loc => (
                  <div key={loc.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-2 rounded-xl flex-shrink-0 ${loc.is_active ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                          <MapPin size={14}/>
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{loc.name}</p>
                          {loc.is_active
                            ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">Activa</span>
                            : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-500">Inactiva</span>}
                        </div>
                      </div>
                    </div>

                    {loc.address && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 truncate">{loc.address}</p>
                    )}

                    <p className="text-xs font-mono text-slate-400 mb-3">
                      {parseFloat(loc.latitude).toFixed(5)}, {parseFloat(loc.longitude).toFixed(5)}
                    </p>

                    <div className="flex items-center gap-2 mb-4">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
                        Radio: {loc.radius_m}m
                      </span>
                      <a href={`https://www.openstreetmap.org/?mlat=${loc.latitude}&mlon=${loc.longitude}&zoom=16`}
                        target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-500 transition-colors">
                        <Eye size={11}/> Ver mapa
                      </a>
                    </div>

                    <div className="flex gap-2 border-t border-slate-100 dark:border-slate-700 pt-3">
                      <button onClick={() => { setEditLoc(loc); setShowLocModal(true); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                        <Pencil size={11}/> Editar
                      </button>
                      <button onClick={() => handleDeleteLoc(loc)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Trash2 size={11}/> Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Mis permisos (usuario) ──────────────────────────────── */}
        {tab === 'mis-permisos' && !isAdmin && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">{myLeaves.length} solicitud{myLeaves.length !== 1 ? 'es' : ''}</p>
              <button onClick={() => setShowLeaveForm(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
                <Plus size={14}/> Nueva solicitud
              </button>
            </div>
            {loadingLeaves ? <p className="text-sm text-slate-400 animate-pulse">Cargando...</p>
              : myLeaves.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-10 text-center">
                  <CalendarDays size={28} className="text-slate-300 mx-auto mb-2"/>
                  <p className="text-slate-500 text-sm">Sin solicitudes de permiso.</p>
                </div>
              ) : myLeaves.map(l => <LeaveCard key={l.id} leave={l} onCancel={handleCancelLeave}/>)}
          </div>
        )}

        {/* ── TAB: Permisos (admin) ─────────────────────────────────────── */}
        {tab === 'permisos' && isAdmin && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 px-6 py-4 flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Usuario</label>
                <select className={inp} value={leaveFilters.user_id} onChange={e => setLeaveFilters(f => ({...f, user_id: e.target.value}))}>
                  <option value="">Todos</option>
                  {usersList.map(u => <option key={u.id} value={u.id}>{u.first_name ? `${u.first_name} ${u.last_name}` : u.username}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Estado</label>
                <select className={inp} value={leaveFilters.status} onChange={e => setLeaveFilters(f => ({...f, status: e.target.value}))}>
                  <option value="">Todos</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="aprobado">Aprobado</option>
                  <option value="rechazado">Rechazado</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tipo</label>
                <select className={inp} value={leaveFilters.type} onChange={e => setLeaveFilters(f => ({...f, type: e.target.value}))}>
                  <option value="">Todos</option>
                  <option value="vacaciones">Vacaciones</option>
                  <option value="enfermedad">Enfermedad</option>
                  <option value="permiso">Permiso</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <button onClick={loadAllLeaves}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
                <Filter size={13}/> Filtrar
              </button>
            </div>

            {loadingAllL ? <p className="text-sm text-slate-400 animate-pulse">Cargando...</p>
              : allLeaves.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-10 text-center">
                  <CalendarDays size={28} className="text-slate-300 mx-auto mb-2"/>
                  <p className="text-slate-500 text-sm">Sin solicitudes.</p>
                </div>
              ) : allLeaves.map(l => (
                <LeaveCard key={l.id} leave={l} showUser
                  onApprove={l.status === 'pendiente' ? () => handleApproveLeave(l.id) : null}
                  onReject={l.status === 'pendiente'  ? () => handleRejectLeave(l.id)  : null}/>
              ))}
          </div>
        )}

        {/* ── TAB: Reporte mensual (admin) ──────────────────────────────── */}
        {tab === 'reporte' && isAdmin && (
          <div className="space-y-5">
            {/* Controls */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 px-6 py-4 flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Año</label>
                <input className={inp} type="number" value={reportYear} min={2020} max={2099} onChange={e => setReportYear(+e.target.value)} style={{width:90}}/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Mes</label>
                <select className={inp} value={reportMonth} onChange={e => setReportMonth(+e.target.value)}>
                  {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((m,i) => (
                    <option key={i+1} value={i+1}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Usuario</label>
                <select className={inp} value={reportUser} onChange={e => setReportUser(e.target.value)}>
                  <option value="">Todos</option>
                  {usersList.map(u => <option key={u.id} value={u.id}>{u.first_name ? `${u.first_name} ${u.last_name}` : u.username}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={loadReport}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
                  <FileText size={13}/> Generar
                </button>
                {reportData && (
                  <button onClick={() => exportReportCSV(reportData)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <Download size={13}/> CSV
                  </button>
                )}
              </div>
            </div>

            {loadingReport ? (
              <p className="text-sm text-slate-400 animate-pulse">Generando reporte...</p>
            ) : reportData ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-500">
                  Reporte de <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][reportData.month]} {reportData.year}
                  </span> · {reportData.report.length} empleado{reportData.report.length !== 1 ? 's' : ''}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-700/50">
                        {['Empleado','Presentes','Ausentes','Tardanzas','Permisos','Horas trabajadas','Horas extra','GPS violaciones'].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {reportData.report.map(row => (
                        <tr key={row.user_id} className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                          <td className="px-3 py-2.5">
                            <p className="font-medium text-slate-800 dark:text-slate-100">{row.user_name}</p>
                            <p className="text-xs text-slate-400">{row.user_email}</p>
                          </td>
                          <td className="px-3 py-2.5 text-center"><span className="font-semibold text-emerald-600">{row.present_days}</span></td>
                          <td className="px-3 py-2.5 text-center"><span className={`font-semibold ${row.absent_days > 0 ? 'text-red-500' : 'text-slate-400'}`}>{row.absent_days}</span></td>
                          <td className="px-3 py-2.5 text-center"><span className={`font-semibold ${row.tardy_days > 0 ? 'text-amber-500' : 'text-slate-400'}`}>{row.tardy_days}</span></td>
                          <td className="px-3 py-2.5 text-center"><span className="font-semibold text-blue-500">{row.leave_days}</span></td>
                          <td className="px-3 py-2.5 text-center"><span className="font-mono font-medium text-slate-700 dark:text-slate-200">{row.total_hours}h</span></td>
                          <td className="px-3 py-2.5 text-center"><span className={`font-mono font-medium ${row.overtime_hours > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>{row.overtime_hours}h</span></td>
                          <td className="px-3 py-2.5 text-center"><span className={`font-semibold ${row.geo_violations > 0 ? 'text-red-500' : 'text-slate-400'}`}>{row.geo_violations}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-10 text-center">
                <FileText size={28} className="text-slate-300 mx-auto mb-2"/>
                <p className="text-slate-500 text-sm">Selecciona año y mes, luego presiona "Generar".</p>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Horarios (admin) ─────────────────────────────────────── */}
        {tab === 'horario' && isAdmin && (
          <div className="space-y-5">
            {/* User selector */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 px-6 py-4 flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Editar horario de</label>
                <select className={inp} value={selectedSchUser} onChange={e => { setSelectedSchUser(e.target.value); loadSchedule(e.target.value); }}>
                  <option value="">Horario predeterminado (empresa)</option>
                  {usersList.map(u => <option key={u.id} value={u.id}>{u.first_name ? `${u.first_name} ${u.last_name}` : u.username}</option>)}
                </select>
              </div>
              {selectedSchUser && (
                <button onClick={async () => { await scheduleAPI.deleteForUser(selectedSchUser); toast.success('Horario personalizado eliminado'); setSelectedSchUser(''); loadSchedule(''); }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border border-red-200 dark:border-red-800">
                  <Trash2 size={12}/> Eliminar personalizado
                </button>
              )}
            </div>

            {loadingSchedule ? <p className="text-sm text-slate-400 animate-pulse">Cargando...</p>
              : schedule && <ScheduleEditor schedule={schedule} saving={savingSchedule}
                  onSave={async (s) => {
                    setSavingSchedule(true);
                    try {
                      selectedSchUser
                        ? await scheduleAPI.saveForUser(selectedSchUser, s)
                        : await scheduleAPI.saveDefault(s);
                      toast.success('Horario guardado');
                      loadSchedule(selectedSchUser);
                    } catch (err) { toast.error(err.response?.data?.message ?? 'Error'); }
                    finally { setSavingSchedule(false); }
                  }}/>}
          </div>
        )}

        {/* ── Modals ───────────────────────────────────────────────────── */}
        {showLocModal && (
          <LocationModal loc={editLoc} onClose={() => setShowLocModal(false)}
            onSaved={() => { setShowLocModal(false); loadLocations(); loadStatus(); }}/>
        )}
        {showRecModal && (
          <RecordModal record={editRecord} users={usersList} locations={locations}
            onClose={() => setShowRecModal(false)}
            onSaved={() => { setShowRecModal(false); loadRecords(recPage); if (tab==='dashboard') loadToday(); }}/>
        )}
        {showLeaveForm && (
          <LeaveForm onClose={() => setShowLeaveForm(false)}
            onSaved={() => { setShowLeaveForm(false); loadMyLeaves(); }}/>
        )}
      </div>
    </Layout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LeaveCard
// ─────────────────────────────────────────────────────────────────────────────

const LEAVE_TYPE_STYLES = {
  vacaciones: { label:'Vacaciones', bg:'bg-blue-50 dark:bg-blue-900/20', text:'text-blue-700 dark:text-blue-400', icon: Sun },
  enfermedad: { label:'Enfermedad', bg:'bg-red-50 dark:bg-red-900/20',   text:'text-red-700 dark:text-red-400',   icon: HeartPulse },
  permiso:    { label:'Permiso',    bg:'bg-amber-50 dark:bg-amber-900/20',text:'text-amber-700 dark:text-amber-400',icon: Clock },
  otro:       { label:'Otro',       bg:'bg-slate-50 dark:bg-slate-700',   text:'text-slate-600 dark:text-slate-300',icon: MoreHorizontal },
};
const LEAVE_STATUS_STYLES = {
  pendiente: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  aprobado:  'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  rechazado: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  cancelado: 'bg-slate-100 dark:bg-slate-700 text-slate-500',
};
const STATUS_LABELS = { pendiente:'Pendiente', aprobado:'Aprobado', rechazado:'Rechazado', cancelado:'Cancelado' };

function LeaveCard({ leave: l, showUser, onApprove, onReject, onCancel }) {
  const ts = LEAVE_TYPE_STYLES[l.type] ?? LEAVE_TYPE_STYLES.otro;
  const TypeIcon = ts.icon;
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className={`p-2.5 rounded-xl ${ts.bg} ${ts.text} flex-shrink-0 self-start`}>
        <TypeIcon size={16}/>
      </div>
      <div className="flex-1 min-w-0">
        {showUser && l.user_name && <p className="text-xs text-slate-500 mb-0.5">{l.user_name}</p>}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold ${ts.text}`}>{ts.label}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${LEAVE_STATUS_STYLES[l.status]}`}>
            {STATUS_LABELS[l.status]}
          </span>
        </div>
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 mt-0.5">
          {new Date(l.start_date + 'T12:00').toLocaleDateString('es-MX', { day:'2-digit', month:'short' })}
          {l.start_date !== l.end_date && ` → ${new Date(l.end_date + 'T12:00').toLocaleDateString('es-MX', { day:'2-digit', month:'short' })}`}
          <span className="text-slate-400 font-normal ml-2">({l.days_count} día{l.days_count !== 1 ? 's' : ''})</span>
        </p>
        {l.reason && <p className="text-xs text-slate-500 mt-0.5 truncate">{l.reason}</p>}
        {l.review_notes && <p className="text-xs text-slate-400 mt-0.5 italic">"{l.review_notes}"</p>}
      </div>
      <div className="flex gap-2 flex-shrink-0">
        {onApprove && (
          <button onClick={onApprove}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">
            <CheckCircle2 size={11}/> Aprobar
          </button>
        )}
        {onReject && (
          <button onClick={onReject}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-700 text-white transition-colors">
            <XCircle size={11}/> Rechazar
          </button>
        )}
        {onCancel && l.status === 'pendiente' && (
          <button onClick={onCancel}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <X size={11}/> Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LeaveForm
// ─────────────────────────────────────────────────────────────────────────────

function LeaveForm({ onClose, onSaved }) {
  const [form, setForm] = useState({ type:'permiso', start_date:'', end_date:'', reason:'' });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f => ({...f, [k]:v}));
  const inp = 'w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400';

  const submit = async e => {
    e.preventDefault();
    if (!form.start_date) { toast.error('Selecciona la fecha de inicio'); return; }
    setSaving(true);
    try {
      await leaveAPI.create({ ...form, end_date: form.end_date || form.start_date });
      toast.success('Solicitud enviada');
      onSaved();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <CalendarDays size={16} className="text-indigo-500"/> Nueva solicitud de permiso
          </h2>
          <button onClick={onClose}><X size={18} className="text-slate-400"/></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tipo</label>
            <select className={inp} value={form.type} onChange={e => set('type', e.target.value)}>
              <option value="vacaciones">🏖️ Vacaciones</option>
              <option value="enfermedad">🏥 Enfermedad</option>
              <option value="permiso">📋 Permiso personal</option>
              <option value="otro">📌 Otro</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Desde *</label>
              <input className={inp} type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} required/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Hasta</label>
              <input className={inp} type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} min={form.start_date}/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Motivo</label>
            <textarea className={`${inp} h-24 resize-none`} value={form.reason} onChange={e => set('reason', e.target.value)} placeholder="Describe el motivo de tu solicitud..."/>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
              <Save size={14}/> {saving ? 'Enviando...' : 'Enviar solicitud'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ScheduleEditor
// ─────────────────────────────────────────────────────────────────────────────

const DAYS = [
  { key:'mon', label:'Lunes'     },
  { key:'tue', label:'Martes'    },
  { key:'wed', label:'Miércoles' },
  { key:'thu', label:'Jueves'    },
  { key:'fri', label:'Viernes'   },
  { key:'sat', label:'Sábado'    },
  { key:'sun', label:'Domingo'   },
];

function ScheduleEditor({ schedule: initial, saving, onSave }) {
  const [form, setForm] = useState({ ...initial });
  const set = (k,v) => setForm(f => ({...f, [k]:v}));
  const inp = 'border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400';

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-800 dark:text-slate-100">
            {form.user_id ? 'Horario personalizado' : 'Horario predeterminado de la empresa'}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Define las horas de trabajo por día. La tolerancia es el margen antes de marcar tardanza.</p>
        </div>
      </div>
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nombre del horario</label>
            <input className={`${inp} w-full`} value={form.name ?? ''} onChange={e => set('name', e.target.value)} placeholder="Horario estándar"/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tolerancia (minutos)</label>
            <input className={`${inp} w-full`} type="number" min={0} max={60} value={form.tolerance_min ?? 10} onChange={e => set('tolerance_min', e.target.value)}/>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/50">
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Día</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Activo</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Entrada</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Salida</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Horas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {DAYS.map(({ key, label }) => {
                const active = !!form[`${key}_active`];
                const start  = form[`${key}_start`] ?? '';
                const end    = form[`${key}_end`]   ?? '';
                const hrs    = active && start && end
                  ? Math.max(0, (new Date(`2000-01-01T${end}`) - new Date(`2000-01-01T${start}`)) / 3600000).toFixed(1)
                  : '—';
                return (
                  <tr key={key} className={`${active ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/50 dark:bg-slate-700/30 opacity-60'} transition-opacity`}>
                    <td className="px-3 py-2.5 font-medium text-slate-700 dark:text-slate-200">{label}</td>
                    <td className="px-3 py-2.5">
                      <button type="button" onClick={() => set(`${key}_active`, active ? 0 : 1)}
                        className={`relative w-9 h-5 rounded-full transition-colors ${active ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${active ? 'translate-x-4' : 'translate-x-0.5'}`}/>
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <input type="time" className={inp} disabled={!active} value={start} onChange={e => set(`${key}_start`, e.target.value)}/>
                    </td>
                    <td className="px-3 py-2.5">
                      <input type="time" className={inp} disabled={!active} value={end} onChange={e => set(`${key}_end`, e.target.value)}/>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 font-mono">{hrs}{hrs !== '—' ? 'h' : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end pt-2">
          <button onClick={() => onSave(form)} disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-60">
            <Save size={14}/> {saving ? 'Guardando...' : 'Guardar horario'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Export report CSV
// ─────────────────────────────────────────────────────────────────────────────

function exportReportCSV(reportData) {
  const cols = ['Empleado','Email','Días presentes','Días ausentes','Tardanzas','Días permiso','Horas trabajadas','Horas extra','Violaciones GPS'];
  const lines = [cols.join(',')];
  reportData.report.forEach(r => {
    lines.push([
      `"${r.user_name}"`, r.user_email, r.present_days, r.absent_days,
      r.tardy_days, r.leave_days, r.total_hours, r.overtime_hours, r.geo_violations,
    ].join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `reporte_asistencia_${reportData.year}_${String(reportData.month).padStart(2,'0')}.csv`;
  a.click();
}
