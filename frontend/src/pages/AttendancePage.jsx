import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  MapPin, LogIn, LogOut, Clock, CheckCircle2, XCircle,
  AlertTriangle, RefreshCw, Settings, ChevronDown, ChevronUp,
  Navigation, Pencil, X, Save, Users, Filter,
} from 'lucide-react';
import { attendanceAPI } from '../services/attendanceAPI';
import { useAuthStore } from '../stores/authStore';
import Layout from '../components/Layout';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(checkInAt, checkOutAt) {
  const from = new Date(checkInAt);
  const to   = checkOutAt ? new Date(checkOutAt) : new Date();
  const sec  = Math.floor((to - from) / 1000);
  const h    = Math.floor(sec / 3600);
  const m    = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function GeoStatus({ valid, distM, radiusM }) {
  if (distM === null || distM === undefined) {
    return <span className="text-xs text-gray-400 flex items-center gap-1"><AlertTriangle size={12} /> Sin GPS</span>;
  }
  return valid
    ? <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 size={12} /> {distM}m de distancia</span>
    : <span className="text-xs text-red-500 flex items-center gap-1"><XCircle size={12} /> {distM}m (radio: {radiusM}m)</span>;
}

// ── Location modal (admin) ────────────────────────────────────────────────────

function LocationModal({ loc, onClose, onSaved }) {
  const isNew = !loc?.id;
  const [form, setForm] = useState({
    name:      loc?.name      ?? '',
    address:   loc?.address   ?? '',
    latitude:  loc?.latitude  ?? '',
    longitude: loc?.longitude ?? '',
    radius_m:  loc?.radius_m  ?? 100,
    is_active: loc?.is_active ?? 1,
  });
  const [picking, setPicking] = useState(false);
  const [saving, setSaving]   = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const detectLocation = () => {
    setPicking(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set('latitude',  pos.coords.latitude.toFixed(7));
        set('longitude', pos.coords.longitude.toFixed(7));
        setPicking(false);
        toast.success('Coordenadas capturadas');
      },
      () => { toast.error('No se pudo obtener la ubicación'); setPicking(false); }
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isNew) {
        await attendanceAPI.createLocation(form);
        toast.success('Ubicación creada');
      } else {
        await attendanceAPI.updateLocation(loc.id, form);
        toast.success('Ubicación actualizada');
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b dark:border-gray-700">
          <h2 className="font-semibold text-lg">{isNew ? 'Nueva ubicación' : 'Editar ubicación'}</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre *</label>
            <input className="input w-full" value={form.name} onChange={e => set('name', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Dirección</label>
            <input className="input w-full" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Opcional" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Latitud *</label>
              <input className="input w-full" type="number" step="any" value={form.latitude} onChange={e => set('latitude', e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Longitud *</label>
              <input className="input w-full" type="number" step="any" value={form.longitude} onChange={e => set('longitude', e.target.value)} required />
            </div>
          </div>
          <button type="button" onClick={detectLocation} disabled={picking}
            className="btn btn-secondary w-full flex items-center justify-center gap-2 text-sm">
            <Navigation size={14} />
            {picking ? 'Detectando...' : 'Usar mi ubicación actual'}
          </button>
          <div>
            <label className="block text-sm font-medium mb-1">Radio permitido (metros)</label>
            <input className="input w-full" type="number" min={10} value={form.radius_m} onChange={e => set('radius_m', e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="loc_active" checked={!!form.is_active} onChange={e => set('is_active', e.target.checked ? 1 : 0)} />
            <label htmlFor="loc_active" className="text-sm">Ubicación activa</label>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={saving} className="btn btn-primary flex-1 flex items-center justify-center gap-2">
              <Save size={14} /> {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Record edit modal (admin) ─────────────────────────────────────────────────

function RecordEditModal({ record, onClose, onSaved }) {
  const toLocal = (dt) => dt ? new Date(new Date(dt) - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
  const [form, setForm] = useState({
    check_in_at:  toLocal(record.check_in_at),
    check_out_at: toLocal(record.check_out_at),
    notes: record.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await attendanceAPI.updateRecord(record.id, form);
      toast.success('Registro actualizado');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Error al actualizar');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b dark:border-gray-700">
          <h2 className="font-semibold">Editar registro #{record.id}</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Entrada</label>
            <input className="input w-full" type="datetime-local" value={form.check_in_at} onChange={e => set('check_in_at', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Salida</label>
            <input className="input w-full" type="datetime-local" value={form.check_out_at} onChange={e => set('check_out_at', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notas</label>
            <textarea className="input w-full h-20" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={saving} className="btn btn-primary flex-1 flex items-center justify-center gap-2">
              <Save size={14} /> {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const { user } = useAuthStore();
  const isAdmin  = user?.role === 'admin';

  const [tab, setTab] = useState('my'); // 'my' | 'admin' | 'locations'

  // Status
  const [status, setStatus]       = useState(null); // { open, locations }
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Actions
  const [selectedLoc, setSelectedLoc] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // History
  const [myRecords, setMyRecords] = useState([]);
  const [loadingMy, setLoadingMy] = useState(false);

  // Admin records
  const [allRecords, setAllRecords]   = useState([]);
  const [loadingAll, setLoadingAll]   = useState(false);
  const [filters, setFilters]         = useState({ date_from: '', date_to: '', user_id: '', location_id: '' });
  const [editRecord, setEditRecord]   = useState(null);

  // Locations
  const [locations, setLocations]     = useState([]);
  const [loadingLocs, setLoadingLocs] = useState(false);
  const [editLocation, setEditLocation] = useState(null); // null | {} (new) | {id,...}
  const [showLocModal, setShowLocModal] = useState(false);

  // GPS
  const [geoCoords, setGeoCoords] = useState(null);
  const [geoError, setGeoError]   = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const { data } = await attendanceAPI.status();
      setStatus(data);
      if (!selectedLoc && data.locations?.length === 1) {
        setSelectedLoc(String(data.locations[0].id));
      }
    } catch { toast.error('Error al cargar el estado'); }
    finally { setLoadingStatus(false); }
  }, []);

  const loadMyRecords = useCallback(async () => {
    setLoadingMy(true);
    try {
      const { data } = await attendanceAPI.myRecords({ limit: 30 });
      setMyRecords(data);
    } catch { toast.error('Error al cargar historial'); }
    finally { setLoadingMy(false); }
  }, []);

  const loadAllRecords = useCallback(async () => {
    setLoadingAll(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const { data } = await attendanceAPI.allRecords({ ...params, limit: 100 });
      setAllRecords(data);
    } catch { toast.error('Error al cargar registros'); }
    finally { setLoadingAll(false); }
  }, [filters]);

  const loadLocations = useCallback(async () => {
    setLoadingLocs(true);
    try {
      const { data } = await attendanceAPI.getLocations();
      setLocations(data);
    } catch { toast.error('Error al cargar ubicaciones'); }
    finally { setLoadingLocs(false); }
  }, []);

  useEffect(() => { loadStatus(); loadMyRecords(); }, []);
  useEffect(() => { if (tab === 'admin' && isAdmin) loadAllRecords(); }, [tab, isAdmin]);
  useEffect(() => { if (tab === 'locations' && isAdmin) loadLocations(); }, [tab, isAdmin]);

  const getGPS = () => new Promise((resolve, reject) => {
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setGeoCoords(coords);
        setGeoLoading(false);
        resolve(coords);
      },
      (err) => {
        setGeoError('No se pudo obtener la ubicación GPS. El registro se guardará sin validación geográfica.');
        setGeoLoading(false);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

  const handleCheckIn = async () => {
    if (!selectedLoc) { toast.error('Selecciona una ubicación'); return; }
    setActionLoading(true);
    const coords = await getGPS();
    try {
      const payload = { location_id: parseInt(selectedLoc, 10), ...coords };
      const { data } = await attendanceAPI.checkIn(payload);
      if (data.geo_valid) {
        toast.success(`Entrada registrada — estás dentro del área permitida (${data.distance_m}m)`);
      } else if (data.distance_m !== null) {
        toast.warning(`Entrada registrada pero estás fuera del área permitida (${data.distance_m}m)`);
      } else {
        toast.info('Entrada registrada sin verificación GPS');
      }
      loadStatus();
      loadMyRecords();
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Error al registrar entrada');
    } finally { setActionLoading(false); }
  };

  const handleCheckOut = async () => {
    setActionLoading(true);
    const coords = await getGPS();
    try {
      const payload = coords ?? {};
      const { data } = await attendanceAPI.checkOut(payload);
      if (data.geo_valid) {
        toast.success(`Salida registrada — dentro del área permitida (${data.distance_m}m)`);
      } else if (data.distance_m !== null) {
        toast.warning(`Salida registrada fuera del área permitida (${data.distance_m}m)`);
      } else {
        toast.info('Salida registrada sin verificación GPS');
      }
      loadStatus();
      loadMyRecords();
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Error al registrar salida');
    } finally { setActionLoading(false); }
  };

  const deleteLocation = async (id) => {
    if (!confirm('¿Eliminar esta ubicación?')) return;
    try {
      await attendanceAPI.deleteLocation(id);
      toast.success('Ubicación eliminada');
      loadLocations();
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Error al eliminar');
    }
  };

  const open = status?.open;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MapPin className="text-blue-500" size={24} />
            <h1 className="text-2xl font-bold">Asistencia</h1>
          </div>
          <button onClick={loadStatus} className="btn btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw size={14} /> Actualizar
          </button>
        </div>

        {/* Check-in / Check-out card */}
        <div className="card p-6 space-y-4">
          {loadingStatus ? (
            <p className="text-sm text-gray-500">Cargando estado...</p>
          ) : open ? (
            // Active session
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-semibold">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                Sesión activa
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <p><span className="font-medium">Ubicación:</span> {open.location_name ?? '—'}</p>
                <p><span className="font-medium">Entrada:</span> {new Date(open.check_in_at).toLocaleString()}</p>
                <p><span className="font-medium">Duración:</span> {formatDuration(open.check_in_at, null)}</p>
                <GeoStatus valid={!!open.check_in_valid} distM={open.check_in_dist_m} radiusM={null} />
              </div>
              <button onClick={handleCheckOut} disabled={actionLoading || geoLoading}
                className="btn btn-danger flex items-center gap-2">
                <LogOut size={16} />
                {actionLoading ? 'Registrando...' : 'Registrar Salida'}
              </button>
            </div>
          ) : (
            // No active session
            <div className="space-y-3">
              <p className="text-sm text-gray-500">No tienes ninguna sesión activa.</p>
              <div>
                <label className="block text-sm font-medium mb-1">Ubicación de trabajo</label>
                <select className="input w-full max-w-xs" value={selectedLoc} onChange={e => setSelectedLoc(e.target.value)}>
                  <option value="">— Selecciona una ubicación —</option>
                  {status?.locations?.map(l => (
                    <option key={l.id} value={l.id}>{l.name}{l.address ? ` · ${l.address}` : ''}</option>
                  ))}
                </select>
              </div>
              <button onClick={handleCheckIn} disabled={actionLoading || geoLoading || !selectedLoc}
                className="btn btn-primary flex items-center gap-2">
                <LogIn size={16} />
                {actionLoading ? 'Registrando...' : 'Registrar Entrada'}
              </button>
            </div>
          )}

          {geoLoading && (
            <p className="text-xs text-blue-500 flex items-center gap-1"><Navigation size={12} className="animate-pulse" /> Obteniendo GPS...</p>
          )}
          {geoError && (
            <p className="text-xs text-amber-500 flex items-center gap-1"><AlertTriangle size={12} /> {geoError}</p>
          )}
          {geoCoords && !geoLoading && (
            <p className="text-xs text-gray-400">GPS: {geoCoords.latitude.toFixed(5)}, {geoCoords.longitude.toFixed(5)}</p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b dark:border-gray-700">
          {[
            { key: 'my', label: 'Mi historial', icon: Clock },
            ...(isAdmin ? [
              { key: 'admin', label: 'Todos los registros', icon: Users },
              { key: 'locations', label: 'Ubicaciones', icon: Settings },
            ] : []),
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px
                ${tab === key ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* Tab: My records */}
        {tab === 'my' && (
          <div className="space-y-3">
            {loadingMy ? <p className="text-sm text-gray-500">Cargando...</p> : myRecords.length === 0 ? (
              <p className="text-sm text-gray-400">Sin registros aún.</p>
            ) : myRecords.map(r => (
              <RecordRow key={r.id} record={r} showUser={false} />
            ))}
          </div>
        )}

        {/* Tab: All records (admin) */}
        {tab === 'admin' && isAdmin && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="card p-4 flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs font-medium mb-1">Desde</label>
                <input className="input text-sm" type="date" value={filters.date_from}
                  onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Hasta</label>
                <input className="input text-sm" type="date" value={filters.date_to}
                  onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))} />
              </div>
              <button onClick={loadAllRecords} className="btn btn-primary flex items-center gap-2 text-sm h-9">
                <Filter size={13} /> Filtrar
              </button>
            </div>

            {loadingAll ? <p className="text-sm text-gray-500">Cargando...</p> : allRecords.length === 0 ? (
              <p className="text-sm text-gray-400">Sin registros para los filtros aplicados.</p>
            ) : allRecords.map(r => (
              <RecordRow key={r.id} record={r} showUser onEdit={() => setEditRecord(r)} />
            ))}
          </div>
        )}

        {/* Tab: Locations (admin) */}
        {tab === 'locations' && isAdmin && (
          <div className="space-y-4">
            <button onClick={() => { setEditLocation({}); setShowLocModal(true); }}
              className="btn btn-primary flex items-center gap-2 text-sm">
              <MapPin size={14} /> Nueva ubicación
            </button>

            {loadingLocs ? <p className="text-sm text-gray-500">Cargando...</p> : locations.length === 0 ? (
              <p className="text-sm text-gray-400">No hay ubicaciones configuradas.</p>
            ) : (
              <div className="space-y-3">
                {locations.map(loc => (
                  <div key={loc.id} className="card p-4 flex items-center justify-between gap-4">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{loc.name}</span>
                        {loc.is_active ? (
                          <span className="badge badge-green text-xs">Activa</span>
                        ) : (
                          <span className="badge badge-gray text-xs">Inactiva</span>
                        )}
                      </div>
                      {loc.address && <p className="text-xs text-gray-500 truncate">{loc.address}</p>}
                      <p className="text-xs text-gray-400">
                        {parseFloat(loc.latitude).toFixed(5)}, {parseFloat(loc.longitude).toFixed(5)} · Radio: {loc.radius_m}m
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => { setEditLocation(loc); setShowLocModal(true); }}
                        className="btn btn-secondary btn-sm flex items-center gap-1 text-xs">
                        <Pencil size={12} /> Editar
                      </button>
                      <button onClick={() => deleteLocation(loc.id)}
                        className="btn btn-danger btn-sm flex items-center gap-1 text-xs">
                        <X size={12} /> Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modals */}
        {showLocModal && (
          <LocationModal
            loc={editLocation}
            onClose={() => setShowLocModal(false)}
            onSaved={() => { setShowLocModal(false); loadLocations(); loadStatus(); }}
          />
        )}
        {editRecord && (
          <RecordEditModal
            record={editRecord}
            onClose={() => setEditRecord(null)}
            onSaved={() => { setEditRecord(null); loadAllRecords(); }}
          />
        )}
      </div>
    </Layout>
  );
}

// ── Record row component ──────────────────────────────────────────────────────

function RecordRow({ record: r, showUser, onEdit }) {
  const [expanded, setExpanded] = useState(false);

  const statusColor = {
    open:   'badge-green',
    closed: 'badge-gray',
    manual: 'badge-yellow',
  }[r.status] ?? 'badge-gray';

  return (
    <div className="card overflow-hidden">
      <button onClick={() => setExpanded(e => !e)}
        className="w-full p-4 flex items-center justify-between gap-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <Clock size={16} className="text-blue-400 shrink-0" />
          <div className="min-w-0 space-y-0.5">
            {showUser && r.user_name && (
              <p className="text-xs text-gray-500 truncate">{r.user_name}</p>
            )}
            <p className="text-sm font-medium truncate">
              {new Date(r.check_in_at).toLocaleDateString()} · {r.location_name ?? 'Sin ubicación'}
            </p>
            <p className="text-xs text-gray-500">
              {new Date(r.check_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {r.check_out_at && ` → ${new Date(r.check_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
              {' · '}{formatDuration(r.check_in_at, r.check_out_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`badge ${statusColor} text-xs capitalize`}>
            {r.status === 'open' ? 'Activo' : r.status === 'closed' ? 'Cerrado' : 'Manual'}
          </span>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t dark:border-gray-700 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400 mb-1">Entrada</p>
            <p>{new Date(r.check_in_at).toLocaleString()}</p>
            <GeoStatus valid={!!r.check_in_valid} distM={r.check_in_dist_m} radiusM={null} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400 mb-1">Salida</p>
            {r.check_out_at ? (
              <>
                <p>{new Date(r.check_out_at).toLocaleString()}</p>
                <GeoStatus valid={!!r.check_out_valid} distM={r.check_out_dist_m} radiusM={null} />
              </>
            ) : <p className="text-gray-400">—</p>}
          </div>
          {r.notes && (
            <div className="col-span-2">
              <p className="text-xs font-semibold uppercase text-gray-400 mb-1">Notas</p>
              <p className="text-sm">{r.notes}</p>
            </div>
          )}
          {onEdit && (
            <div className="col-span-2">
              <button onClick={onEdit} className="btn btn-secondary btn-sm flex items-center gap-1 text-xs">
                <Pencil size={12} /> Corregir registro
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
