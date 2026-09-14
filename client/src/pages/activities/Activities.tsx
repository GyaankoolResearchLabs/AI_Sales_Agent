import { useState } from 'react';
import { Plus } from 'lucide-react';
import { activitiesApi } from '../../api/resources';
import DataTable, { Column } from '../../components/DataTable';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import { Activity } from '../../types';
import { useToast } from '../../stores/ToastContext';

const TYPES = ['email', 'call', 'meeting', 'whatsapp', 'note', 'task'] as const;

export default function Activities() {
  const [type, setType] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const { data, isLoading, isError, refetch } = activitiesApi.useList({ type: type || undefined, limit: 30, sort: '-createdAt' });

  const columns: Column<Activity>[] = [
    { header: 'Type', accessor: (a) => <Badge tone="blue">{a.type}</Badge> },
    { header: 'Subject', accessor: (a) => <span className="font-medium text-gray-900">{a.subject}</span> },
    { header: 'Owner', accessor: (a) => a.owner?.name },
    { header: 'Status', accessor: (a) => (a.isCompleted ? <Badge tone="green">Completed</Badge> : <Badge tone="gray">Pending</Badge>) },
    { header: 'Date', accessor: (a) => new Date(a.createdAt).toLocaleString() },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Activities</h1>
          <p className="text-sm text-gray-500">{data?.pagination?.total ?? 0} total</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus size={15} /> Log Activity
        </Button>
      </div>

      <div className="flex gap-2">
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring">
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(a) => a._id}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyTitle="No activities logged yet"
        emptyDescription="Log a call, email, meeting or note to start building the timeline."
        emptyAction={
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus size={14} /> Log activity
          </Button>
        }
      />

      <ActivityFormModal open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}

function ActivityFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ type: 'note' as string, subject: '', body: '', isCompleted: true });
  const create = activitiesApi.useCreate();
  const toast = useToast();

  const submit = async () => {
    try {
      await create.mutateAsync(form as never);
      toast.show('Activity logged', 'success');
      setForm({ type: 'note', subject: '', body: '', isCompleted: true });
      onClose();
    } catch {
      toast.show('Could not log activity', 'error');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log activity"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} loading={create.isPending} disabled={!form.subject}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Type</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring">
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Subject *</label>
          <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Notes</label>
          <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring" />
        </div>
      </div>
    </Modal>
  );
}
