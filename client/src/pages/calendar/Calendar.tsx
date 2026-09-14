import { useState } from 'react';
import { Plus, MapPin, Video } from 'lucide-react';
import { meetingsApi } from '../../api/resources';
import DataTable, { Column } from '../../components/DataTable';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import { Meeting } from '../../types/meeting';
import { useAuth } from '../../stores/AuthContext';
import { useToast } from '../../stores/ToastContext';

export default function Calendar() {
  const [formOpen, setFormOpen] = useState(false);
  const { data, isLoading, isError, refetch } = meetingsApi.useList({ limit: 50, sort: 'startTime' });

  const upcoming = (data?.items ?? []).filter((m) => new Date(m.startTime) >= new Date());
  const past = (data?.items ?? []).filter((m) => new Date(m.startTime) < new Date());

  const columns: Column<Meeting>[] = [
    { header: 'Title', accessor: (m) => <span className="font-medium text-gray-900">{m.title}</span> },
    { header: 'When', accessor: (m) => new Date(m.startTime).toLocaleString() },
    { header: 'Location', accessor: (m) => (m.location ? <span className="flex items-center gap-1"><MapPin size={12} />{m.location}</span> : <span className="flex items-center gap-1 text-gray-400"><Video size={12} />Video call</span>) },
    { header: 'Status', accessor: (m) => <Badge tone={m.status === 'completed' ? 'green' : m.status === 'cancelled' ? 'red' : 'blue'}>{m.status.replace('_', ' ')}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Calendar</h1>
          <p className="text-sm text-gray-500">Meetings sync via Google/Outlook Calendar once connected in Settings → Integrations.</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus size={15} /> Schedule meeting
        </Button>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Upcoming</h2>
        <DataTable columns={columns} rows={upcoming} rowKey={(m) => m._id} isLoading={isLoading} isError={isError} onRetry={refetch} emptyTitle="No upcoming meetings" />
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-gray-900">Past</h2>
          <DataTable columns={columns} rows={past} rowKey={(m) => m._id} />
        </section>
      )}

      <MeetingFormModal open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}

function MeetingFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ title: '', startTime: '', endTime: '', location: '' });
  const create = meetingsApi.useCreate();
  const { user } = useAuth();
  const toast = useToast();

  const submit = async () => {
    try {
      await create.mutateAsync({ ...form, organizer: user!.id } as never);
      toast.show('Meeting scheduled (development calendar adapter)', 'success');
      setForm({ title: '', startTime: '', endTime: '', location: '' });
      onClose();
    } catch {
      toast.show('Could not schedule meeting', 'error');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Schedule meeting"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} loading={create.isPending} disabled={!form.title || !form.startTime || !form.endTime}>
            Schedule
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Title *</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Start *</label>
            <input type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">End *</label>
            <input type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Location</label>
          <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring" />
        </div>
      </div>
    </Modal>
  );
}
