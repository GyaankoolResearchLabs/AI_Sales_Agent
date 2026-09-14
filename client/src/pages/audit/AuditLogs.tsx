import { useState } from 'react';
import { Bot, User as UserIcon, Cog } from 'lucide-react';
import { useAuditLogs } from '../../api/misc';
import DataTable, { Column } from '../../components/DataTable';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import { AuditLogEntry } from '../../types';

const ACTOR_ICON = { user: UserIcon, ai_agent: Bot, system: Cog };

export default function AuditLogs() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useAuditLogs(page);

  const columns: Column<AuditLogEntry>[] = [
    {
      header: 'Actor',
      accessor: (l) => {
        const Icon = ACTOR_ICON[l.actorType];
        return (
          <span className="flex items-center gap-1.5">
            <Icon size={13} className={l.actorType === 'ai_agent' ? 'text-brand-500' : 'text-gray-400'} />
            {l.actorType === 'user' ? l.actor?.name ?? 'Unknown' : l.actorType === 'ai_agent' ? 'AI Sales Agent' : 'System'}
          </span>
        );
      },
    },
    { header: 'Action', accessor: (l) => <span className="font-mono text-xs text-gray-700">{l.action}</span> },
    { header: 'Entity', accessor: (l) => l.entityType },
    {
      header: 'Approval',
      accessor: (l) =>
        l.approvalRequired ? <Badge tone={l.approvedBy ? 'green' : 'amber'}>{l.approvedBy ? `Approved by ${l.approvedBy.name}` : 'Pending'}</Badge> : <span className="text-gray-400">—</span>,
    },
    { header: 'Time', accessor: (l) => new Date(l.createdAt).toLocaleString() },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Audit Logs</h1>
        <p className="text-sm text-gray-500">Every important CRM change and AI action, with who approved it.</p>
      </div>

      <DataTable columns={columns} rows={data?.items ?? []} rowKey={(l) => l._id} isLoading={isLoading} isError={isError} onRetry={refetch} emptyTitle="No audit entries yet" />

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
    </div>
  );
}
