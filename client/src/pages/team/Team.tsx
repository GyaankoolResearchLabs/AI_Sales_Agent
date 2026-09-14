import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useTeam, useInviteUser, useUpdateUser } from '../../api/misc';
import DataTable, { Column } from '../../components/DataTable';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import { User, UserRole } from '../../types';
import { useToast } from '../../stores/ToastContext';

const ROLES: UserRole[] = ['sales_rep', 'sales_manager', 'sales_director', 'admin'];

export default function Team() {
  const { data, isLoading, isError, refetch } = useTeam();
  const [formOpen, setFormOpen] = useState(false);
  const updateUser = useUpdateUser();

  const columns: Column<User & { isActive?: boolean }>[] = [
    { header: 'Name', accessor: (u) => <span className="font-medium text-gray-900">{u.name}</span> },
    { header: 'Email', accessor: (u) => u.email },
    { header: 'Title', accessor: (u) => u.title || '—' },
    {
      header: 'Role',
      accessor: (u) => (
        <select
          value={u.role}
          onChange={(e) => updateUser.mutate({ id: u.id, payload: { role: e.target.value as UserRole } })}
          className="rounded border border-gray-200 px-2 py-1 text-xs"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r.replace('_', ' ')}
            </option>
          ))}
        </select>
      ),
    },
    { header: 'Status', accessor: (u) => <Badge tone={u.isActive === false ? 'gray' : 'green'}>{u.isActive === false ? 'Inactive' : 'Active'}</Badge> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Team</h1>
          <p className="text-sm text-gray-500">Manage members, roles, and permissions.</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <UserPlus size={15} /> Invite member
        </Button>
      </div>

      <DataTable columns={columns} rows={data ?? []} rowKey={(u) => u.id} isLoading={isLoading} isError={isError} onRetry={refetch} emptyTitle="No team members yet" />

      <InviteModal open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}

function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', role: 'sales_rep' as UserRole, title: '' });
  const invite = useInviteUser();
  const toast = useToast();
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const submit = async () => {
    try {
      const res = await invite.mutateAsync(form);
      setTempPassword(res.temporaryPassword);
      toast.show('Member invited', 'success');
    } catch {
      toast.show('Could not invite member', 'error');
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        setTempPassword(null);
        onClose();
      }}
      title="Invite team member"
      footer={
        tempPassword ? (
          <Button size="sm" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={submit} loading={invite.isPending} disabled={!form.name || !form.email}>
              Send invite
            </Button>
          </>
        )
      }
    >
      {tempPassword ? (
        <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          <p className="font-medium">Account created.</p>
          <p className="mt-1">
            Temporary password: <code className="rounded bg-white px-1.5 py-0.5">{tempPassword}</code>
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            Development mode: no real email was sent. Share this password with {form.name} directly, or connect a production email provider in
            Settings.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Email *</label>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Role</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </Modal>
  );
}
