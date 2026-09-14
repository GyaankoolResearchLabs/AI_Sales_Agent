import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Monitor, Trash2 } from 'lucide-react';
import { http, ApiEnvelope } from '../../api/http';
import Button from '../../components/Button';
import PageLoader from '../../components/PageLoader';
import { useToast } from '../../stores/ToastContext';

interface Session {
  id: string;
  userAgent?: string;
  ip?: string;
  createdAt: string;
  expiresAt: string;
}
interface SecurityConfig {
  ssoEnabled: boolean;
  ipAllowlist: string[];
}

export default function SettingsSecurity() {
  const qc = useQueryClient();
  const toast = useToast();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['security', 'sessions'],
    queryFn: async () => (await http.get<ApiEnvelope<Session[]>>('/settings/security/sessions')).data.data,
  });
  const { data: security } = useQuery({
    queryKey: ['security', 'config'],
    queryFn: async () => (await http.get<ApiEnvelope<SecurityConfig>>('/settings/security')).data.data,
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => http.delete(`/settings/security/sessions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['security', 'sessions'] }),
  });

  const updateSecurity = useMutation({
    mutationFn: async (payload: SecurityConfig) => (await http.patch<ApiEnvelope<SecurityConfig>>('/settings/security', payload)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['security', 'config'] }),
  });

  const [sso, setSso] = useState(false);
  const [allowlist, setAllowlist] = useState('');

  useEffect(() => {
    if (security) {
      setSso(security.ssoEnabled);
      setAllowlist(security.ipAllowlist.join('\n'));
    }
  }, [security]);

  if (isLoading) return <PageLoader />;

  return (
    <div className="max-w-2xl space-y-5">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Active sessions</h2>
        <div className="space-y-2">
          {sessions?.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
              <div className="flex items-center gap-2">
                <Monitor size={15} className="text-gray-400" />
                <div>
                  <p className="text-sm text-gray-700">{s.userAgent || 'Unknown device'}</p>
                  <p className="text-xs text-gray-400">Signed in {new Date(s.createdAt).toLocaleString()}</p>
                </div>
              </div>
              <button onClick={() => revoke.mutate(s.id)} className="text-gray-400 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {(sessions?.length ?? 0) === 0 && <p className="text-sm text-gray-400">No active sessions.</p>}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">SSO</h2>
        <p className="mb-3 text-xs text-gray-500">
          Single sign-on architecture (SAML/OIDC) is scaffolded for enterprise plans. Toggling this marks the organization as SSO-required; wiring an
          actual identity provider requires configuring a production SSO connector.
        </p>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={sso} onChange={(e) => setSso(e.target.checked)} /> Require SSO for this organization
        </label>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">IP allowlist</h2>
        <p className="mb-2 text-xs text-gray-500">One IP or CIDR range per line. Leave empty to allow all IPs.</p>
        <textarea value={allowlist} onChange={(e) => setAllowlist(e.target.value)} rows={4} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus-ring" />
      </div>

      <div className="flex justify-end">
        <Button
          onClick={async () => {
            await updateSecurity.mutateAsync({ ssoEnabled: sso, ipAllowlist: allowlist.split('\n').map((s) => s.trim()).filter(Boolean) });
            toast.show('Security settings updated', 'success');
          }}
          loading={updateSecurity.isPending}
        >
          Save security settings
        </Button>
      </div>
    </div>
  );
}
