import { useState } from 'react';
import { Plus, Check, Bot } from 'lucide-react';
import { tasksApi } from '../../api/resources';
import DataTable, { Column } from '../../components/DataTable';
import Button from '../../components/Button';
import Badge, { priorityTone } from '../../components/Badge';
import Modal from '../../components/Modal';
import { Task } from '../../types';
import { useToast } from '../../stores/ToastContext';
import { useAuth } from '../../stores/AuthContext';
import { http } from '../../api/http';
import { useQueryClient } from '@tanstack/react-query';

export default function Tasks() {
  const [status, setStatus] = useState('open');
  const [formOpen, setFormOpen] = useState(false);
  const { data, isLoading, isError, refetch } = tasksApi.useList({ status: status || undefined, limit: 30 });
  const qc = useQueryClient();
  const toast = useToast();

  const complete = async (id: string) => {
    await http.post(`/tasks/${id}/complete`);
    qc.invalidateQueries({ queryKey: ['tasks'] });
    toast.show('Task completed', 'success');
  };

  const columns: Column<Task>[] = [
    {
      header: '',
      accessor: (t) =>
        t.status !== 'completed' && (
          <button onClick={() => complete(t._id)} className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 hover:border-emerald-500 hover:bg-emerald-50" aria-label="Complete task">
            <Check size={11} className="text-transparent hover:text-emerald-600" />
          </button>
        ),
    },
    {
      header: 'Task',
      accessor: (t) => (
        <span className="flex items-center gap-1.5 font-medium text-gray-900">
          {t.title}
          {t.createdByAI && <Bot size={13} className="text-brand-500" aria-label="Created by AI" />}
        </span>
      ),
    },
    { header: 'Priority', accessor: (t) => <Badge tone={priorityTone(t.priority)}>{t.priority}</Badge> },
    { header: 'Due', accessor: (t) => (t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—') },
    { header: 'Assigned to', accessor: (t) => t.assignedTo?.name },
    { header: 'Status', accessor: (t) => <Badge tone={t.status === 'completed' ? 'green' : 'gray'}>{t.status.replace('_', ' ')}</Badge> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-500">{data?.pagination?.total ?? 0} total</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus size={15} /> New Task
        </Button>
      </div>

      <div className="flex gap-2">
        {['open', 'in_progress', 'completed', ''].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatus(s)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${status === s ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500'}`}
          >
            {s ? s.replace('_', ' ') : 'All'}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(t) => t._id}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyTitle="No tasks"
        emptyDescription="Create a task, or let the AI Assistant create follow-ups for you."
        emptyAction={
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus size={14} /> Create task
          </Button>
        }
      />

      <TaskFormModal open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}

function TaskFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ title: '', dueDate: '', priority: 'medium' });
  const create = tasksApi.useCreate();
  const toast = useToast();
  const { user } = useAuth();

  const submit = async () => {
    try {
      await create.mutateAsync({ ...form, assignedTo: user!.id } as never);
      toast.show('Task created', 'success');
      setForm({ title: '', dueDate: '', priority: 'medium' });
      onClose();
    } catch {
      toast.show('Could not create task', 'error');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New task"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} loading={create.isPending} disabled={!form.title}>
            Create
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
            <label className="mb-1 block text-xs font-medium text-gray-600">Due date</label>
            <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Priority</label>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring">
              {['low', 'medium', 'high', 'urgent'].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </Modal>
  );
}
