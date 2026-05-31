import { useEffect, useState } from 'react';
import { projectsAPI } from '../services/projectsAPI';
import { useAuthStore } from '../stores/authStore';
import Layout from '../components/Layout';
import { toast } from 'sonner';
import { Save, Building2, Lock, Shield, Plus, Trash2 } from 'lucide-react';

const FIELDS = [
  { key: 'name',                label: 'Nombre Comercial',    required: true },
  { key: 'legal_name',          label: 'Razón Social' },
  { key: 'representative_name', label: 'Representante Legal' },
  { key: 'rfc',                 label: 'RFC' },
  { key: 'tax_regime',          label: 'Régimen Fiscal' },
  { key: 'address',             label: 'Dirección' },
  { key: 'zip_code',            label: 'Código Postal' },
  { key: 'email',               label: 'Correo Electrónico', type: 'email' },
  { key: 'phone',               label: 'Teléfono' },
  { key: 'website',             label: 'Sitio Web', type: 'url' },
];

function IPAllowlistSection({ isAdmin }) {
  const [rules, setRules]       = useState([]);
  const [loadingIP, setLoadingIP] = useState(true);
  const [ipForm, setIpForm]     = useState(null);
  const [savingIP, setSavingIP] = useState(false);
  const EMPTY_IP = { ip_cidr: '', description: '', is_active: true };

  useEffect(() => {
    projectsAPI.getIPAllowlist()
      .then(r => setRules(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingIP(false));
  }, []);

  const saveIP = async () => {
    if (!ipForm.ip_cidr.trim()) { toast.error('Ingresa una IP o rango CIDR'); return; }
    setSavingIP(true);
    try {
      if (ipForm.id) {
        await projectsAPI.updateIPRule(ipForm.id, ipForm);
      } else {
        await projectsAPI.createIPRule(ipForm);
      }
      toast.success('Regla guardada');
      setIpForm(null);
      const r = await projectsAPI.getIPAllowlist();
      setRules(r.data ?? []);
    } catch { toast.error('Error al guardar regla'); }
    finally { setSavingIP(false); }
  };

  const removeIP = async (id) => {
    if (!confirm('¿Eliminar esta regla IP?')) return;
    try {
      await projectsAPI.deleteIPRule(id);
      setRules(prev => prev.filter(r => r.id !== id));
      toast.success('Regla eliminada');
    } catch { toast.error('Error al eliminar'); }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-indigo-600" />
          <div>
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Lista blanca de IPs</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Si está vacía, se permiten todas las IPs. Si tiene reglas, solo las IPs listadas pueden acceder.</p>
          </div>
        </div>
        {isAdmin && !ipForm && (
          <button onClick={() => setIpForm({ ...EMPTY_IP })}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
            <Plus size={13} /> Añadir IP
          </button>
        )}
      </div>

      {ipForm && (
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-3 border border-slate-200 dark:border-slate-600">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">IP o rango CIDR</label>
              <input type="text" value={ipForm.ip_cidr} onChange={e => setIpForm(f => ({ ...f, ip_cidr: e.target.value }))}
                placeholder="192.168.1.0/24 o 10.0.0.1"
                className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Descripción</label>
              <input type="text" value={ipForm.description} onChange={e => setIpForm(f => ({ ...f, description: e.target.value }))}
                placeholder="ej: Oficina central"
                className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            <input type="checkbox" checked={!!ipForm.is_active} onChange={e => setIpForm(f => ({ ...f, is_active: e.target.checked }))} className="accent-indigo-600" />
            Regla activa
          </label>
          <div className="flex gap-2">
            <button onClick={saveIP} disabled={savingIP}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
              {savingIP ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={() => setIpForm(null)}
              className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loadingIP ? (
        <p className="text-xs text-slate-400 text-center py-4">Cargando…</p>
      ) : rules.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">Sin reglas — todas las IPs están permitidas</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
              <th className="text-left py-2 px-3 font-medium">IP / CIDR</th>
              <th className="text-left py-2 px-3 font-medium">Descripción</th>
              <th className="text-left py-2 px-3 font-medium">Estado</th>
              {isAdmin && <th className="py-2 px-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {rules.map(r => (
              <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                <td className="py-2 px-3"><code className="text-xs font-mono text-slate-700 dark:text-slate-200">{r.ip_cidr}</code></td>
                <td className="py-2 px-3 text-xs text-slate-500 dark:text-slate-400">{r.description || '—'}</td>
                <td className="py-2 px-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {r.is_active ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                {isAdmin && (
                  <td className="py-2 px-3 text-right">
                    <button onClick={() => setIpForm({ ...r })} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mr-3">Editar</button>
                    <button onClick={() => removeIP(r.id)} className="text-xs text-red-500 hover:underline"><Trash2 size={11} className="inline" /></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function CompanySettingsPage() {
  const { user } = useAuthStore();
  const isAdmin      = user?.role === 'ADMIN';
  const isTeamMember = user?.role === 'TEAM_MEMBER';

  const [form, setForm]     = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    if (isTeamMember) { setLoading(false); return; }
    projectsAPI.getCompanySettings()
      .then((r) => setForm(r.data || {}))
      .catch(() => toast.error('Error al cargar configuración'))
      .finally(() => setLoading(false));
  }, [isTeamMember]);

  const handle = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    setSaving(true);
    try {
      await projectsAPI.updateCompanySettings(form);
      toast.success('Configuración guardada');
    } catch { toast.error('Error al guardar'); }
    finally { setSaving(false); }
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  if (isTeamMember) {
    return (
      <Layout>
        <div className="p-4 sm:p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <Lock size={28} className="text-slate-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">Acceso restringido</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs">
            La información de la empresa no está disponible para tu rol.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-6">
          <Building2 size={24} className="text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Configuración de Empresa</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Datos de la organización usados en documentos y reportes</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-400">Cargando...</div>
        ) : (
          <form onSubmit={handle}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 space-y-4">
              {!isAdmin && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                  Solo los administradores pueden editar la configuración de empresa.
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {FIELDS.map(({ key, label, required, type = 'text' }) => (
                  <div key={key} className={key === 'address' ? 'col-span-2' : ''}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {label}{required && ' *'}
                    </label>
                    <input
                      type={type}
                      value={form[key] || ''}
                      onChange={(e) => set(key, e.target.value)}
                      required={required}
                      disabled={!isAdmin}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm
                        focus:outline-none focus:ring-2 focus:ring-indigo-500
                        disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                    />
                  </div>
                ))}
              </div>

              {isAdmin && (
                <div className="flex justify-end pt-2">
                  <button type="submit" disabled={saving}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60
                      text-white font-semibold px-5 py-2.5 rounded-lg transition-colors">
                    <Save size={16} />
                    {saving ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              )}
            </div>
          </form>
        )}

        {/* IP Allowlist — admin only */}
        {isAdmin && <IPAllowlistSection isAdmin={isAdmin} />}
      </div>
    </Layout>
  );
}
