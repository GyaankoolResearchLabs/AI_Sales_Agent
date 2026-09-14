import { useState } from 'react';
import { Plus } from 'lucide-react';
import { dealsApi } from '../../api/resources';
import { useOrganization } from '../../api/misc';
import { useDebounce } from '../../hooks/useDebounce';
import DataTable, { Column } from '../../components/DataTable';
import SearchInput from '../../components/SearchInput';
import Button from '../../components/Button';
import Badge, { healthTone } from '../../components/Badge';
import { Deal } from '../../types';
import DealFormModal from './DealFormModal';

export default function Deals() {
  const [search, setSearch] = useState('');
  const [stageKey, setStageKey] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const debouncedSearch = useDebounce(search);
  const { data: org } = useOrganization();

  const { data, isLoading, isError, refetch } = dealsApi.useList({ search: debouncedSearch, stageKey: stageKey || undefined, page, limit: 20, sort: '-updatedAt' });

  const stageLabel = (key: string) => org?.dealStages.find((s) => s.key === key)?.label ?? key;

  const columns: Column<Deal>[] = [
    { header: 'Deal', accessor: (d) => <span className="font-medium text-gray-900">{d.name}</span> },
    { header: 'Company', accessor: (d) => d.company?.name || '—' },
    { header: 'Value', accessor: (d) => `$${d.value.toLocaleString()}` },
    { header: 'Stage', accessor: (d) => <Badge tone="blue">{stageLabel(d.stageKey)}</Badge> },
    { header: 'AI Score', accessor: (d) => (d.aiScore ? <Badge tone={healthTone(d.aiScore.health)}>{d.aiScore.probability}%</Badge> : '—') },
    { header: 'Owner', accessor: (d) => d.owner?.name },
    { header: 'Last activity', accessor: (d) => (d.lastActivityAt ? new Date(d.lastActivityAt).toLocaleDateString() : '—') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Deals</h1>
          <p className="text-sm text-gray-500">{data?.pagination?.total ?? 0} total</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus size={15} /> New Deal
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <SearchInput value={search} onChange={setSearch} placeholder="Search deals…" />
        </div>
        <select value={stageKey} onChange={(e) => setStageKey(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring">
          <option value="">All stages</option>
          {org?.dealStages.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(d) => d._id}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        rowHref={(d) => `/deals/${d._id}`}
        emptyTitle="No deals yet"
        emptyDescription="Create your first opportunity, or import from a CSV."
        emptyAction={
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus size={14} /> Create deal
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

      <DealFormModal open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}
