import { useState } from 'react';
import { Plus, ShieldCheck } from 'lucide-react';
import { contactsApi } from '../../api/resources';
import { useDebounce } from '../../hooks/useDebounce';
import DataTable, { Column } from '../../components/DataTable';
import SearchInput from '../../components/SearchInput';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import { Contact } from '../../types';
import { useToast } from '../../stores/ToastContext';

export default function Contacts() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const debouncedSearch = useDebounce(search);
  const { data, isLoading, isError, refetch } = contactsApi.useList({ search: debouncedSearch, page, limit: 20 });

  const columns: Column<Contact>[] = [
    {
      header: 'Name',
      accessor: (c) => (
        <span className="flex items-center gap-1.5 font-medium text-gray-900">
          {c.name}
          {c.isDecisionMaker && <ShieldCheck size={13} className="text-brand-500" aria-label="Decision maker" />}
        </span>
      ),
    },
    { header: 'Email', accessor: (c) => c.email || '—' },
    { header: 'Company', accessor: (c) => c.company?.name || '—' },
    { header: 'Job title', accessor: (c) => c.jobTitle || '—' },
    { header: 'Owner', accessor: (c) => c.owner?.name || 'Unassigned' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Contacts</h1>
          <p className="text-sm text-gray-500">{data?.pagination?.total ?? 0} total</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus size={15} /> New Contact
        </Button>
      </div>

      <div className="max-w-xs">
        <SearchInput value={search} onChange={setSearch} placeholder="Search contacts…" />
      </div>

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(c) => c._id}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyTitle="No contacts yet"
        emptyDescription="Add your first contact, or import from a CSV."
        emptyAction={
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus size={14} /> Create contact
          </Button>
        }
      />

      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm text-gray-500">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span>
            Page {page} of {data.pagination.totalPages}
          </span>
          <Button variant="secondary" size="sm" disabled={page >= data.pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      <ContactFormModal open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}

function ContactFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', jobTitle: '', isDecisionMaker: false });
  const create = contactsApi.useCreate();
  const toast = useToast();

  const submit = async () => {
    try {
      await create.mutateAsync(form);
      toast.show('Contact created', 'success');
      setForm({ name: '', email: '', phone: '', jobTitle: '', isDecisionMaker: false });
      onClose();
    } catch {
      toast.show('Could not create contact', 'error');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New contact"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} loading={create.isPending} disabled={!form.name}>
            Create
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Name *</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Email</label>
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Phone</label>
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Job title</label>
          <input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring" />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.isDecisionMaker} onChange={(e) => setForm({ ...form, isDecisionMaker: e.target.checked })} />
          Decision maker
        </label>
      </div>
    </Modal>
  );
}
