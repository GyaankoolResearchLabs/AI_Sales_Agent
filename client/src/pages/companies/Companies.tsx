import { useState } from 'react';
import { Plus } from 'lucide-react';
import { companiesApi } from '../../api/resources';
import { useDebounce } from '../../hooks/useDebounce';
import DataTable, { Column } from '../../components/DataTable';
import SearchInput from '../../components/SearchInput';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import { Company } from '../../types';
import { useToast } from '../../stores/ToastContext';

export default function Companies() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const debouncedSearch = useDebounce(search);
  const { data, isLoading, isError, refetch } = companiesApi.useList({ search: debouncedSearch, page, limit: 20 });

  const columns: Column<Company>[] = [
    { header: 'Name', accessor: (c) => <span className="font-medium text-gray-900">{c.name}</span> },
    { header: 'Industry', accessor: (c) => c.industry || '—' },
    { header: 'Employees', accessor: (c) => c.employees?.toLocaleString() || '—' },
    { header: 'Location', accessor: (c) => c.location || '—' },
    { header: 'Owner', accessor: (c) => c.owner?.name || 'Unassigned' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Companies</h1>
          <p className="text-sm text-gray-500">{data?.pagination?.total ?? 0} total</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus size={15} /> New Company
        </Button>
      </div>

      <div className="max-w-xs">
        <SearchInput value={search} onChange={setSearch} placeholder="Search companies…" />
      </div>

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(c) => c._id}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyTitle="No companies yet"
        emptyDescription="Add your first company, or import from a CSV."
        emptyAction={
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus size={14} /> Create company
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

      <CompanyFormModal open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}

function CompanyFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', industry: '', website: '', location: '' });
  const create = companiesApi.useCreate();
  const toast = useToast();

  const submit = async () => {
    try {
      await create.mutateAsync(form);
      toast.show('Company created', 'success');
      setForm({ name: '', industry: '', website: '', location: '' });
      onClose();
    } catch {
      toast.show('Could not create company', 'error');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New company"
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
        {(['name', 'industry', 'website', 'location'] as const).map((field) => (
          <div key={field}>
            <label className="mb-1 block text-xs font-medium capitalize text-gray-600">{field}{field === 'name' ? ' *' : ''}</label>
            <input
              value={form[field]}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring"
            />
          </div>
        ))}
      </div>
    </Modal>
  );
}
