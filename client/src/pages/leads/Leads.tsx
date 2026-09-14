import { useState } from 'react';
import { Plus, Flame } from 'lucide-react';
import { leadsApi } from '../../api/resources';
import { useDebounce } from '../../hooks/useDebounce';
import DataTable, { Column } from '../../components/DataTable';
import SearchInput from '../../components/SearchInput';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import { Lead } from '../../types';
import LeadFormModal from './LeadFormModal';

const STATUS_TONE: Record<string, 'gray' | 'blue' | 'amber' | 'green' | 'red'> = {
  new: 'gray',
  contacted: 'blue',
  qualifying: 'amber',
  qualified: 'green',
  disqualified: 'red',
  converted: 'green',
};

export default function Leads() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const debouncedSearch = useDebounce(search);

  const { data, isLoading, isError, refetch } = leadsApi.useList({ search: debouncedSearch, status: status || undefined, page, limit: 20, sort: '-score' });

  const columns: Column<Lead>[] = [
    { header: 'Name', accessor: (l) => <span className="font-medium text-gray-900">{l.name}</span> },
    { header: 'Company', accessor: (l) => l.companyName || '—' },
    { header: 'Score', accessor: (l) => <Badge tone={l.score >= 70 ? 'red' : l.score >= 40 ? 'amber' : 'gray'}>{l.score >= 70 && <Flame size={11} />} {l.score}</Badge> },
    { header: 'Status', accessor: (l) => <Badge tone={STATUS_TONE[l.status] ?? 'gray'}>{l.status.replace('_', ' ')}</Badge> },
    { header: 'Owner', accessor: (l) => l.owner?.name || 'Unassigned' },
    { header: 'Last activity', accessor: (l) => (l.lastActivityAt ? new Date(l.lastActivityAt).toLocaleDateString() : '—') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500">{data?.pagination?.total ?? 0} total</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus size={15} /> New Lead
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <SearchInput value={search} onChange={setSearch} placeholder="Search leads…" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring">
          <option value="">All statuses</option>
          {['new', 'contacted', 'qualifying', 'qualified', 'disqualified', 'converted'].map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(l) => l._id}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        rowHref={(l) => `/leads/${l._id}`}
        emptyTitle="No leads yet"
        emptyDescription="Create your first lead, or import your existing leads from a CSV."
        emptyAction={
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus size={14} /> Create lead
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

      <LeadFormModal open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}
