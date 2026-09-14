import { Eye, Lightbulb, FileEdit, Zap, ShieldAlert } from 'lucide-react';
import { useAutonomySettings, useUpdateAutonomySettings } from '../../api/ai';
import PageLoader from '../../components/PageLoader';
import { useToast } from '../../stores/ToastContext';
import { useAuth } from '../../stores/AuthContext';
import { extractErrorMessage } from '../../api/http';
import { AutonomyLevel, PermissionMode } from '../../types';

const CAN_MANAGE_ROLES = ['sales_director', 'admin'];

const LEVELS: { level: AutonomyLevel; title: string; description: string; icon: typeof Eye }[] = [
  { level: 1, title: 'Observe', description: 'AI only analyzes, detects, alerts, and summarizes. It never takes action.', icon: Eye },
  { level: 2, title: 'Recommend', description: 'AI recommends actions. You approve everything before it happens.', icon: Lightbulb },
  { level: 3, title: 'Prepare', description: 'AI prepares emails, WhatsApp messages, call scripts, and CRM updates for your review.', icon: FileEdit },
  { level: 4, title: 'Execute', description: 'AI can execute approved categories automatically, within the permissions below.', icon: Zap },
];

const PERMISSION_ROWS: { key: string; label: string }[] = [
  { key: 'emailSending', label: 'Email sending' },
  { key: 'whatsappSending', label: 'WhatsApp sending' },
  { key: 'crmUpdates', label: 'CRM updates' },
  { key: 'meetingScheduling', label: 'Meeting scheduling' },
  { key: 'proposalCreation', label: 'Proposal creation' },
  { key: 'taskCreation', label: 'Task creation' },
];

export default function SettingsAutonomy() {
  const { data: settings, isLoading } = useAutonomySettings();
  const update = useUpdateAutonomySettings();
  const toast = useToast();
  const { user } = useAuth();
  const canManage = Boolean(user && CAN_MANAGE_ROLES.includes(user.role));

  if (isLoading || !settings) return <PageLoader />;

  const setLevel = async (level: AutonomyLevel) => {
    if (!canManage) return;
    try {
      await update.mutateAsync({ level });
      toast.show(`Autonomy level set to ${LEVELS.find((l) => l.level === level)?.title}`, 'success');
    } catch (err) {
      toast.show(extractErrorMessage(err), 'error');
    }
  };

  const setPermission = async (key: string, value: PermissionMode) => {
    if (!canManage) return;
    try {
      await update.mutateAsync({ permissions: { ...settings.permissions, [key]: value } });
      toast.show('Permission updated', 'success');
    } catch (err) {
      toast.show(extractErrorMessage(err), 'error');
    }
  };

  return (
    <div className="max-w-2xl space-y-5">
      {!canManage && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          <ShieldAlert size={15} className="shrink-0" />
          Only Sales Directors and Admins can change autonomy settings. You can view the current configuration below.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {LEVELS.map((l) => (
          <button
            key={l.level}
            onClick={() => setLevel(l.level)}
            disabled={!canManage}
            className={`rounded-xl border p-4 text-left transition-colors ${
              settings.level === l.level ? 'border-brand-600 bg-brand-50' : 'border-gray-200 bg-white hover:border-gray-300'
            } ${!canManage ? 'cursor-not-allowed opacity-60 hover:border-gray-200' : ''}`}
          >
            <div className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${settings.level === l.level ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                <l.icon size={15} />
              </div>
              <span className="text-sm font-semibold text-gray-900">
                Level {l.level} — {l.title}
              </span>
            </div>
            <p className="mt-2 text-xs text-gray-500">{l.description}</p>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">Granular permissions</h2>
        <p className="mb-3 text-xs text-gray-500">Control exactly which action categories the AI can execute automatically vs. requires your approval.</p>
        <div className="divide-y divide-gray-100">
          {PERMISSION_ROWS.map((row) => (
            <div key={row.key} className="flex items-center justify-between py-2.5">
              <span className="text-sm text-gray-700">{row.label}</span>
              <select
                value={(settings.permissions as unknown as Record<string, string>)[row.key]}
                onChange={(e) => setPermission(row.key, e.target.value as PermissionMode)}
                disabled={!canManage}
                className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs focus-ring disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="allowed">Allowed</option>
                <option value="approval_required">Approval required</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
