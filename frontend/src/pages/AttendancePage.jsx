import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  MapPin, LogIn, LogOut, Clock, CheckCircle2, XCircle,
  AlertTriangle, RefreshCw, Navigation, Pencil, X, Save,
  Users, Filter, Plus, Trash2, Download, ChevronDown, ChevronUp,
  UserCheck, UserX, Activity, TrendingUp, Eye, Calendar,
} from 'lucide-react';
import { attendanceAPI } from '../services/attendanceAPI';
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

function userName(r) {
  if (r.first_name || r.last_name) return `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim();
  return r.user_name ?? r.email ?? `#${r.user_id}`;
}

function exportCSV(rows) {
  const cols = ['ID','Usuario','Email','Ubicación','Entrada','Salida','Duración','GPS Entrada','GPS Salida','Estado','Notas'];
  const lines = [cols.join(',')];
  rows.forEach(r => {
    const dur = r.check_out_at ? fmtDuration(r.check_in_at, r.check_out_at) : 'Activo';
    const geoIn  = r.check_in_lat  != null ? (r.check_in_valid  ? 'OK' : 'FUERA') : 'Sin GPS';
    const geoOut = r.check_out_lat != null ? (r.check_out_valid ? 'OK' : 'FUERA') : '—';
    lines.push([
      r.id, `"${userName(r)}"`, r.user_email ?? '', `"${r.location_name ?? ''}"`,
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
// GeoStatus badge
// ─────────────────────────────────────────────────────────────────────────────

function GeoBadge({ valid, distM, noGps }) {
  if (noGps) return <span className="inline-flex items-center gap-1 text-xs text-gray-400"><AlertTriangle size={11}/>Sin GPS</span>;
  if (valid)  return <span className="inline-flex items-center gap-1 text-xs text-green-600"><CheckCircle2 size={11}/>{distM}m ✓</span>;
  return        <span className="inline-flex items-center gap-1 text-xs text-red-500"><XCircle size={11}/>{distM}m ✗</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat card
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color = 'blue' }) {
  const colors = {
    blue:   'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green:  'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    red:    'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
  };
  return (
    <div className="card p-4 flex items-center gap-4">
      <div className={`p-3 rounded-xl ${colors[color]}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-bold">{value ?? '—'}</p>
        <p className="text-sm text-gray-500">{label}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Location modal (admin)
// ─────────────────────────────────────────────────────────────────────────────

function LocationModal({ loc, onClose, onSaved }) {
  const isNew = !loc?.id;
  const [form, setForm] = useState({
    name:      loc?.name      ?? '',
    address:   loc?.address   ?? '',
    latitude:  loc?.latitude  ?? '',
    longitude: loc?.longitude ?? '',
    radius_m:  loc?.radius_m  ?? 100,
    is_active: loc?.is_active !== undefined ? loc.is_active : 1,
  });
  const [picking, setPicking] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const detectGPS = () => {
    if (!navigator.geolocation) { toast.error('GPS no disponible en este dispositivo'); return; }
    setPicking(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        set('latitude',  pos.coords.latitude.toFixed(7));
        set('longitude', pos.coords.longitude.toFixed(7));
        setPicking(false);
        toast.success('Coordenadas capturadas');
      },
      ()  => { toast.error('No se pudo obtener la ubicación'); setPicking(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const submit = async e => {
    e.preventDefault();
    if (!form.latitude || !form.longitude) { toast.error('Latitud y longitud son obligatorias'); return; }
    setSaving(true);
    try {
      isNew
        ? await attendanceAPI.createLocation(form)
        : await attendanceAPI.updateLocation(loc.id, form);
      toast.success(isNew ? 'Ubicación creada' : 'Ubicación actualizada');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Error al guardar');
    } finally { setSaving(false); }
  };

  const mapsUrl = form.latitude && form.longitude
    ? `https://www.openstreetmap.org/?mlat=${form.latitude}&mlon=${form.longitude}&zoom=16`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg my-4">
        <div className="flex items-center justify-between p-5 border-b dark:border-gray-700">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <MapPin size={18} className="text-blue-500"/>
            {isNew ? 'Nueva ubicación' : 'Editar ubicación'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium mb-1">Nombre *</label>
            <input className="input w-full" value={form.name} onChange={e => set('name', e.target.value)} required placeholder="Ej. Oficina Central" />
          </div>

          {/* Dirección */}
          <div>
            <label className="block text-sm font-medium mb-1">Dirección</label>
            <input className="input w-full" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Calle, ciudad, país (opcional)" />
          </div>

          {/* Coordenadas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Latitud *</label>
              <input className="input w-full font-mono text-sm" type="number" step="any" value={form.latitude}
                onChange={e => set('latitude', e.target.value)} placeholder="19.432608" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Longitud *</label>
              <input className="input w-full font-mono text-sm" type="number" step="any" value={form.longitude}
                onChange={e => set('longitude', e.target.value)} placeholder="-99.133209" required />
            </div>
          </div>

          {/* Botón GPS */}
          <button type="button" onClick={detectGPS} disabled={picking}
            className="w-full btn btn-secondary flex items-center justify-center gap-2 text-sm">
            <Navigation size={14} className={picking ? 'animate-pulse' : ''} />
            {picking ? 'Detectando ubicación...' : 'Usar mi ubicación actual (GPS)'}
          </button>

          {/* Preview mapa */}
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 text-xs text-blue-500 hover:underline">
              <Eye size={12}/> Ver en OpenStreetMap
            </a>
          )}

          {/* Radio */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Radio permitido: <span className="text-blue-500 font-bold">{form.radius_m}m</span>
            </label>
            <input type="range" min={10} max={1000} step={10} value={form.radius_m}
              onChange={e => set('radius_m', e.target.value)} className="w-full accent-blue-500" />
            <div className="flex justify-between text-xs text-gray-400 mt-1"><span>10m</span><span>1000m</span></div>
          </div>

          {/* Activa */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div className={`relative w-10 h-5 rounded-full transition-colors ${form.is_active ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
              onClick={() => set('is_active', form.is_active ? 0 : 1)}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`}/>
            </div>
            <span className="text-sm">{form.is_active ? 'Ubicación activa' : 'Ubicación inactiva'}</span>
          </label>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={saving} className="btn btn-primary flex-1 flex items-center justify-center gap-2">
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
  const toLocal = dt => dt ? new Date(new Date(dt) - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';

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
      isNew
        ? await attendanceAPI.createRecord(form)
        : await attendanceAPI.updateRecord(record.id, form);
      toast.success(isNew ? 'Registro creado' : 'Registro actualizado');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Error al guardar');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b dark:border-gray-700">
          <h2 className="font-semibold flex items-center gap-2">
            <Clock size={16} className="text-blue-500"/>
            {isNew ? 'Crear registro manual' : `Editar registro #${record.id}`}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Usuario *</label>
            <select className="input w-full" value={form.user_id} onChange={e => set('user_id', e.target.value)} required>
              <option value="">— Selecciona usuario —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.first_name ? `${u.first_name} ${u.last_name}` : u.name} ({u.email})</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Ubicación</label>
            <select className="input w-full" value={form.location_id} onChange={e => set('location_id', e.target.value)}>
              <option value="">— Sin ubicación —</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Entrada *</label>
              <input className="input w-full text-sm" type="datetime-local" value={form.check_in_at}
                onChange={e => set('check_in_at', e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Salida</label>
              <input className="input w-full text-sm" type="datetime-local" value={form.check_out_at}
                onChange={e => set('check_out_at', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notas</label>
            <textarea className="input w-full h-20 text-sm resize-none" value={form.notes}
              onChange={e => set('notes', e.target.value)} placeholder="Justificación, observaciones..." />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={saving} className="btn btn-primary flex-1 flex items-center justify-center gap-2">
              <Save size={14}/> {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Present-now card
// ─────────────────────────────────────────────────────────────────────────────

function PresentCard({ record }) {
  const [elapsed, setElapsed] = useState(fmtDuration(record.check_in_at, null));
  useEffect(() => {
    const id = setInterval(() => setElapsed(fmtDuration(record.check_in_at, null)), 30000);
    return () => clearInterval(id);
  }, [record.check_in_at]);

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
      <div className="w-2 h-2 rounded-full bg-green-500 shrink-0 animate-pulse"/>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{userName(record)}</p>
        <p className="text-xs text-gray-500">{record.location_name ?? 'Sin ubicación'} · desde {fmtTime(record.check_in_at)} ({elapsed})</p>
      </div>
      <GeoBadge valid={!!record.check_in_valid} distM={record.check_in_dist_m} noGps={record.check_in_lat == null} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Records table row
// ─────────────────────────────────────────────────────────────────────────────

function RecordRow({ record: r, showUser, onEdit, onDelete }) {
  const [exp, setExp] = useState(false);

  const statusBadge = {
    open:   <span className="badge badge-green text-xs">Activo</span>,
    closed: <span className="badge badge-gray text-xs">Cerrado</span>,
    manual: <span className="badge badge-yellow text-xs">Manual</span>,
  }[r.status] ?? null;

  return (
    <div className="border dark:border-gray-700 rounded-xl overflow-hidden">
      <button onClick={() => setExp(e => !e)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
        <Clock size={15} className="text-blue-400 shrink-0"/>
        <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto] gap-x-3 items-center">
          <div className="min-w-0">
            {showUser && <p className="text-xs text-gray-500 truncate">{userName(r)}</p>}
            <p className="text-sm font-medium truncate">
              {fmtDate(r.check_in_at)} · {r.location_name ?? 'Sin ubicación'}
            </p>
            <p className="text-xs text-gray-400">
              {fmtTime(r.check_in_at)} → {r.check_out_at ? fmtTime(r.check_out_at) : '…'} &nbsp;·&nbsp; {fmtDuration(r.check_in_at, r.check_out_at)}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {statusBadge}
            {exp ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
          </div>
        </div>
      </button>

      {exp && (
        <div className="px-4 pb-4 pt-0 border-t dark:border-gray-700 space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm mt-3">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-400 mb-1">Entrada</p>
              <p>{fmtDateTime(r.check_in_at)}</p>
              <GeoBadge valid={!!r.check_in_valid} distM={r.check_in_dist_m} noGps={r.check_in_lat == null}/>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-gray-400 mb-1">Salida</p>
              {r.check_out_at
                ? <><p>{fmtDateTime(r.check_out_at)}</p><GeoBadge valid={!!r.check_out_valid} distM={r.check_out_dist_m} noGps={r.check_out_lat == null}/></>
                : <p className="text-gray-400">—</p>}
            </div>
          </div>
          {r.notes && <p className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">{r.notes}</p>}
          {(onEdit || onDelete) && (
            <div className="flex gap-2">
              {onEdit   && <button onClick={() => onEdit(r)}   className="btn btn-secondary btn-sm flex items-center gap-1 text-xs"><Pencil size={12}/> Editar</button>}
              {onDelete && <button onClick={() => onDelete(r)} className="btn btn-danger btn-sm flex items-center gap-1 text-xs"><Trash2 size={12}/> Eliminar</button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

const TABS = ['mi-asistencia', 'dashboard', 'registros', 'ubicaciones'];

export default function AttendancePage() {
  const { user } = useAuthStore();
  const isAdmin  = user?.role === 'admin' || user?.role === 'ADMIN';

  const [tab, setTab] = useState(isAdmin ? 'dashboard' : 'mi-asistencia');

  // ── User check-in state ──────────────────────────────────────────────────
  const [status,        setStatus]        = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [selectedLoc,   setSelectedLoc]   = useState('');
  const [actioning,     setActioning]     = useState(false);
  const [geoCoords,     setGeoCoords]     = useState(null);
  const [geoError,      setGeoError]      = useState(null);
  const [geoLoading,    setGeoLoading]    = useState(false);

  // ── My records ───────────────────────────────────────────────────────────
  const [myRecords,   setMyRecords]   = useState([]);
  const [loadingMy,   setLoadingMy]   = useState(false);

  // ── Admin dashboard ──────────────────────────────────────────────────────
  const [todayData,   setTodayData]   = useState(null);
  const [loadingToday,setLoadingToday]= useState(false);

  // ── Admin records ────────────────────────────────────────────────────────
  const [records,     setRecords]     = useState([]);
  const [recordsTotal,setRecordsTotal]= useState(0);
  const [loadingRec,  setLoadingRec]  = useState(false);
  const [recPage,     setRecPage]     = useState(0);
  const PAGE_SIZE = 50;
  const [filters, setFilters] = useState({
    user_id: '', location_id: '', date_from: '', date_to: '', status: '', geo_valid: '',
  });
  const [usersList,   setUsersList]   = useState([]);
  const [editRecord,  setEditRecord]  = useState(null);  // null | {} | {id,...}
  const [showRecModal,setShowRecModal]= useState(false);

  // ── Admin locations ──────────────────────────────────────────────────────
  const [locations,   setLocations]   = useState([]);
  const [loadingLocs, setLoadingLocs] = useState(false);
  const [editLoc,     setEditLoc]     = useState(null);
  const [showLocModal,setShowLocModal]= useState(false);

  // ── Data loaders ─────────────────────────────────────────────────────────

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
    catch { toast.error('Error al cargar tu historial'); }
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
      setRecords(data.data ?? []);
      setRecordsTotal(data.total ?? 0);
      setRecPage(pg);
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
    try { const { data } = await attendanceAPI.usersList(); setUsersList(data); }
    catch {}
  }, []);

  useEffect(() => { loadStatus(); loadMyRecords(); }, []);

  useEffect(() => {
    if (!isAdmin) return;
    if (tab === 'dashboard')   loadToday();
    if (tab === 'registros')  { loadRecords(0); loadUsers(); loadLocations(); }
    if (tab === 'ubicaciones') loadLocations();
  }, [tab, isAdmin]);

  // ── GPS helper ───────────────────────────────────────────────────────────

  const getGPS = () => new Promise(resolve => {
    if (!navigator.geolocation) { resolve(null); return; }
    setGeoLoading(true); setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setGeoCoords(c); setGeoLoading(false); resolve(c);
      },
      () => {
        setGeoError('No se pudo obtener el GPS. El registro se guardará sin validación geográfica.');
        setGeoLoading(false); resolve(null);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

  // ── Check-in / Check-out ─────────────────────────────────────────────────

  const handleCheckIn = async () => {
    if (!selectedLoc) { toast.error('Selecciona una ubicación'); return; }
    setActioning(true);
    const coords = await getGPS();
    try {
      const { data } = await attendanceAPI.checkIn({ location_id: parseInt(selectedLoc), ...coords });
      if      (data.geo_valid)           toast.success(`Entrada registrada ✓ — ${data.distance_m}m del centro`);
      else if (data.distance_m !== null) toast.warning(`Entrada registrada — fuera del área (${data.distance_m}m)`);
      else                               toast.info('Entrada registrada sin verificación GPS');
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
      if      (data.geo_valid)           toast.success(`Salida registrada ✓ — ${data.distance_m}m del centro`);
      else if (data.distance_m !== null) toast.warning(`Salida registrada — fuera del área (${data.distance_m}m)`);
      else                               toast.info('Salida registrada sin verificación GPS');
      loadStatus(); loadMyRecords();
      if (isAdmin && tab === 'dashboard') loadToday();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Error al registrar salida'); }
    finally { setActioning(false); }
  };

  // ── Admin: delete record ─────────────────────────────────────────────────

  const handleDeleteRecord = async r => {
    if (!confirm(`¿Eliminar el registro #${r.id} de ${userName(r)}?`)) return;
    try {
      await attendanceAPI.deleteRecord(r.id);
      toast.success('Registro eliminado');
      loadRecords(recPage);
      if (tab === 'dashboard') loadToday();
    } catch { toast.error('Error al eliminar'); }
  };

  // ── Admin: delete location ───────────────────────────────────────────────

  const handleDeleteLoc = async loc => {
    if (!confirm(`¿Eliminar la ubicación "${loc.name}"?`)) return;
    try {
      await attendanceAPI.deleteLocation(loc.id);
      toast.success('Ubicación eliminada');
      loadLocations(); loadStatus();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Error al eliminar'); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  const open = status?.open;

  const tabItems = [
    { key: 'mi-asistencia', label: 'Mi asistencia', icon: Clock },
    ...(isAdmin ? [
      { key: 'dashboard',   label: 'Dashboard',       icon: Activity },
      { key: 'registros',   label: 'Todos los registros', icon: Users },
      { key: 'ubicaciones', label: 'Ubicaciones',     icon: MapPin },
    ] : []),
  ];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <MapPin className="text-blue-500" size={22}/>
            </div>
            <div>
              <h1 className="text-2xl font-bold">Asistencia</h1>
              <p className="text-sm text-gray-500">Control de entrada y salida con geolocalización</p>
            </div>
          </div>
          <button onClick={() => { loadStatus(); if (tab === 'dashboard') loadToday(); if (tab === 'registros') loadRecords(recPage); if (tab === 'ubicaciones') loadLocations(); }}
            className="btn btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw size={14}/> Actualizar
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 border-b dark:border-gray-700 overflow-x-auto">
          {tabItems.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors -mb-px
                ${tab === key
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
              <Icon size={14}/> {label}
            </button>
          ))}
        </div>

        {/* ── TAB: Mi asistencia ────────────────────────────────────────────── */}
        {tab === 'mi-asistencia' && (
          <div className="space-y-5">
            {/* Check-in / out card */}
            <div className="card p-6">
              {loadingStatus ? (
                <p className="text-sm text-gray-400 animate-pulse">Cargando estado...</p>
              ) : open ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"/>
                    <span className="font-semibold text-green-600 dark:text-green-400">Sesión activa</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Ubicación</p>
                      <p className="font-medium">{open.location_name ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Tiempo activo</p>
                      <p className="font-medium font-mono">{fmtDuration(open.check_in_at, null)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Entrada</p>
                      <p className="font-medium">{fmtDateTime(open.check_in_at)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Validación GPS</p>
                      <GeoBadge valid={!!open.check_in_valid} distM={open.check_in_dist_m} noGps={open.check_in_lat == null}/>
                    </div>
                  </div>
                  <button onClick={handleCheckOut} disabled={actioning || geoLoading}
                    className="btn btn-danger flex items-center gap-2 w-full sm:w-auto justify-center">
                    <LogOut size={16}/>
                    {actioning ? 'Registrando salida...' : 'Registrar Salida'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-gray-500 text-sm">No tienes ninguna sesión activa hoy.</p>
                  <div>
                    <label className="block text-sm font-medium mb-1">Ubicación de trabajo *</label>
                    <select className="input w-full max-w-sm" value={selectedLoc} onChange={e => setSelectedLoc(e.target.value)}>
                      <option value="">— Selecciona una ubicación —</option>
                      {(status?.locations ?? []).map(l => (
                        <option key={l.id} value={l.id}>{l.name}{l.address ? ` · ${l.address}` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <button onClick={handleCheckIn} disabled={actioning || geoLoading || !selectedLoc}
                    className="btn btn-primary flex items-center gap-2 w-full sm:w-auto justify-center">
                    <LogIn size={16}/>
                    {actioning ? 'Registrando entrada...' : 'Registrar Entrada'}
                  </button>
                </div>
              )}

              {geoLoading && (
                <p className="text-xs text-blue-500 flex items-center gap-1.5 mt-3">
                  <Navigation size={12} className="animate-pulse"/> Obteniendo GPS del dispositivo...
                </p>
              )}
              {geoError && (
                <p className="text-xs text-amber-500 flex items-center gap-1.5 mt-3">
                  <AlertTriangle size={12}/> {geoError}
                </p>
              )}
            </div>

            {/* My history */}
            <div>
              <h2 className="text-base font-semibold mb-3">Mi historial</h2>
              {loadingMy ? (
                <p className="text-sm text-gray-400 animate-pulse">Cargando...</p>
              ) : myRecords.length === 0 ? (
                <p className="text-sm text-gray-400">Sin registros aún.</p>
              ) : (
                <div className="space-y-2">
                  {myRecords.map(r => <RecordRow key={r.id} record={r} showUser={false}/>)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: Dashboard (admin) ────────────────────────────────────────── */}
        {tab === 'dashboard' && isAdmin && (
          <div className="space-y-6">
            {loadingToday ? (
              <p className="text-sm text-gray-400 animate-pulse">Cargando datos de hoy...</p>
            ) : todayData ? (
              <>
                {/* Stat cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard icon={UserCheck} label="Presentes ahora"   value={todayData.stats.present_now}    color="green"/>
                  <StatCard icon={Calendar}  label="Registros hoy"     value={todayData.stats.total_today}    color="blue"/>
                  <StatCard icon={TrendingUp} label="Promedio horas"   value={todayData.stats.avg_hours_today != null ? `${todayData.stats.avg_hours_today}h` : '—'} color="yellow"/>
                  <StatCard icon={AlertTriangle} label="Violaciones GPS" value={todayData.stats.geo_violations} color="red"/>
                </div>

                {/* Present now */}
                <div className="card p-5">
                  <h2 className="font-semibold mb-3 flex items-center gap-2">
                    <UserCheck size={16} className="text-green-500"/> Presentes ahora ({todayData.present?.length ?? 0})
                  </h2>
                  {todayData.present?.length === 0 ? (
                    <p className="text-sm text-gray-400 flex items-center gap-2"><UserX size={14}/> Nadie está actualmente registrado</p>
                  ) : (
                    <div className="space-y-2">
                      {todayData.present.map(r => <PresentCard key={r.id} record={r}/>)}
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* ── TAB: Todos los registros (admin) ─────────────────────────────── */}
        {tab === 'registros' && isAdmin && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="card p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium mb-1">Usuario</label>
                  <select className="input text-sm" value={filters.user_id} onChange={e => setFilters(f => ({...f, user_id: e.target.value}))}>
                    <option value="">Todos</option>
                    {usersList.map(u => <option key={u.id} value={u.id}>{u.first_name ? `${u.first_name} ${u.last_name}` : u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Ubicación</label>
                  <select className="input text-sm" value={filters.location_id} onChange={e => setFilters(f => ({...f, location_id: e.target.value}))}>
                    <option value="">Todas</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Desde</label>
                  <input className="input text-sm" type="date" value={filters.date_from} onChange={e => setFilters(f => ({...f, date_from: e.target.value}))}/>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Hasta</label>
                  <input className="input text-sm" type="date" value={filters.date_to} onChange={e => setFilters(f => ({...f, date_to: e.target.value}))}/>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Estado</label>
                  <select className="input text-sm" value={filters.status} onChange={e => setFilters(f => ({...f, status: e.target.value}))}>
                    <option value="">Todos</option>
                    <option value="open">Activo</option>
                    <option value="closed">Cerrado</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">GPS</label>
                  <select className="input text-sm" value={filters.geo_valid} onChange={e => setFilters(f => ({...f, geo_valid: e.target.value}))}>
                    <option value="">Todos</option>
                    <option value="1">Válido</option>
                    <option value="0">Inválido/Sin GPS</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => loadRecords(0)} className="btn btn-primary flex items-center gap-2 text-sm h-9">
                    <Filter size={13}/> Filtrar
                  </button>
                  <button onClick={() => setFilters({ user_id:'', location_id:'', date_from:'', date_to:'', status:'', geo_valid:'' })}
                    className="btn btn-secondary text-sm h-9">Limpiar</button>
                </div>
              </div>
            </div>

            {/* Actions bar */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-sm text-gray-500">{recordsTotal} registro{recordsTotal !== 1 ? 's' : ''} encontrado{recordsTotal !== 1 ? 's' : ''}</p>
              <div className="flex gap-2">
                <button onClick={() => { setEditRecord({}); setShowRecModal(true); }}
                  className="btn btn-primary flex items-center gap-2 text-sm">
                  <Plus size={14}/> Registro manual
                </button>
                <button onClick={() => exportCSV(records)} disabled={records.length === 0}
                  className="btn btn-secondary flex items-center gap-2 text-sm">
                  <Download size={14}/> Exportar CSV
                </button>
              </div>
            </div>

            {/* Records list */}
            {loadingRec ? (
              <p className="text-sm text-gray-400 animate-pulse">Cargando registros...</p>
            ) : records.length === 0 ? (
              <p className="text-sm text-gray-400">Sin registros para los filtros aplicados.</p>
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
                {/* Pagination */}
                {recordsTotal > PAGE_SIZE && (
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button disabled={recPage === 0} onClick={() => loadRecords(recPage - 1)}
                      className="btn btn-secondary text-sm">← Anterior</button>
                    <span className="text-sm text-gray-500">Página {recPage + 1} de {Math.ceil(recordsTotal / PAGE_SIZE)}</span>
                    <button disabled={(recPage + 1) * PAGE_SIZE >= recordsTotal} onClick={() => loadRecords(recPage + 1)}
                      className="btn btn-secondary text-sm">Siguiente →</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── TAB: Ubicaciones (admin) ──────────────────────────────────────── */}
        {tab === 'ubicaciones' && isAdmin && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">{locations.length} ubicación{locations.length !== 1 ? 'es' : ''} configurada{locations.length !== 1 ? 's' : ''}</p>
              <button onClick={() => { setEditLoc({}); setShowLocModal(true); }}
                className="btn btn-primary flex items-center gap-2 text-sm">
                <Plus size={14}/> Nueva ubicación
              </button>
            </div>

            {loadingLocs ? (
              <p className="text-sm text-gray-400 animate-pulse">Cargando...</p>
            ) : locations.length === 0 ? (
              <div className="card p-8 text-center">
                <MapPin size={32} className="text-gray-300 mx-auto mb-2"/>
                <p className="text-gray-500">No hay ubicaciones configuradas.</p>
                <p className="text-sm text-gray-400">Agrega la primera usando el botón de arriba.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {locations.map(loc => (
                  <div key={loc.id} className="card p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`mt-0.5 p-1.5 rounded-lg ${loc.is_active ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>
                          <MapPin size={14}/>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{loc.name}</span>
                            {loc.is_active
                              ? <span className="badge badge-green text-xs">Activa</span>
                              : <span className="badge badge-gray text-xs">Inactiva</span>}
                          </div>
                          {loc.address && <p className="text-xs text-gray-500 mt-0.5 truncate">{loc.address}</p>}
                          <p className="text-xs text-gray-400 mt-1 font-mono">
                            {parseFloat(loc.latitude).toFixed(5)}, {parseFloat(loc.longitude).toFixed(5)}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">
                              Radio: {loc.radius_m}m
                            </span>
                            <a href={`https://www.openstreetmap.org/?mlat=${loc.latitude}&mlon=${loc.longitude}&zoom=16`}
                              target="_blank" rel="noreferrer"
                              className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                              <Eye size={10}/> Ver mapa
                            </a>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => { setEditLoc(loc); setShowLocModal(true); }}
                          className="btn btn-secondary btn-sm flex items-center gap-1 text-xs">
                          <Pencil size={12}/> Editar
                        </button>
                        <button onClick={() => handleDeleteLoc(loc)}
                          className="btn btn-danger btn-sm flex items-center gap-1 text-xs">
                          <Trash2 size={12}/> Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Modals ─────────────────────────────────────────────────────────── */}
        {showLocModal && (
          <LocationModal
            loc={editLoc}
            onClose={() => setShowLocModal(false)}
            onSaved={() => { setShowLocModal(false); loadLocations(); loadStatus(); }}
          />
        )}
        {showRecModal && (
          <RecordModal
            record={editRecord}
            users={usersList}
            locations={locations}
            onClose={() => setShowRecModal(false)}
            onSaved={() => { setShowRecModal(false); loadRecords(recPage); if (tab === 'dashboard') loadToday(); }}
          />
        )}
      </div>
    </Layout>
  );
}
