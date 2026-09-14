import { useState } from 'react';
import { conversationsApi } from '../../api/resources';
import DataTable, { Column } from '../../components/DataTable';
import Badge from '../../components/Badge';
import { Conversation } from '../../types';

const CHANNELS = ['email', 'whatsapp', 'call', 'meeting', 'note'] as const;

export default function Conversations() {
  const [channel, setChannel] = useState('');
  const { data, isLoading, isError, refetch } = conversationsApi.useList({ channel: channel || undefined, limit: 30, sort: '-occurredAt' });

  const columns: Column<Conversation>[] = [
    { header: 'Channel', accessor: (c) => <Badge tone="blue">{c.channel}</Badge> },
    { header: 'Direction', accessor: (c) => <Badge tone={c.direction === 'inbound' ? 'green' : 'gray'}>{c.direction}</Badge> },
    { header: 'Participant', accessor: (c) => c.participant },
    { header: 'Content', accessor: (c) => <span className="line-clamp-1 max-w-md">{c.content}</span> },
    { header: 'Sentiment', accessor: (c) => (c.sentiment ? <Badge tone={c.sentiment === 'positive' ? 'green' : c.sentiment === 'negative' ? 'red' : 'gray'}>{c.sentiment}</Badge> : '—') },
    { header: 'Date', accessor: (c) => new Date(c.occurredAt).toLocaleString() },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Conversations</h1>
        <p className="text-sm text-gray-500">Unified timeline across email, WhatsApp, calls, meetings, and notes.</p>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setChannel('')} className={`rounded-full border px-3 py-1 text-xs font-medium ${!channel ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500'}`}>
          All
        </button>
        {CHANNELS.map((c) => (
          <button
            key={c}
            onClick={() => setChannel(c)}
            className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${channel === c ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500'}`}
          >
            {c}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(c) => c._id}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyTitle="No conversations logged yet"
        emptyDescription="Conversations appear here as emails, calls, and messages are logged against deals and contacts."
      />
    </div>
  );
}
