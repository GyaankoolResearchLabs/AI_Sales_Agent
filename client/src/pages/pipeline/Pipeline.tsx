import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dealsApi } from '../../api/resources';
import { useOrganization } from '../../api/misc';
import { useChangeDealStage } from '../../api/dealExtra';
import PageLoader from '../../components/PageLoader';
import ErrorState from '../../components/ErrorState';
import Badge, { healthTone } from '../../components/Badge';
import { Deal } from '../../types';

export default function Pipeline() {
  const { data: org } = useOrganization();
  const { data, isLoading, isError, refetch } = dealsApi.useList({ limit: 500 });
  const changeStage = useChangeDealStage();
  const navigate = useNavigate();
  const [healthFilter, setHealthFilter] = useState('');
  const [dragging, setDragging] = useState<string | null>(null);

  const stages = useMemo(() => [...(org?.dealStages ?? [])].sort((a, b) => a.order - b.order), [org]);

  const deals = (data?.items ?? []).filter((d) => !healthFilter || d.aiScore?.health === healthFilter);

  if (isLoading) return <PageLoader />;
  if (isError) return <ErrorState onRetry={refetch} />;

  const byStage = (key: string) => deals.filter((d) => d.stageKey === key);
  const stageTotal = (key: string) => byStage(key).reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Pipeline</h1>
          <p className="text-sm text-gray-500">Drag a deal card to change its stage.</p>
        </div>
        <div className="flex gap-1.5">
          {['', 'healthy', 'at_risk', 'stalled'].map((h) => (
            <button
              key={h || 'all'}
              onClick={() => setHealthFilter(h)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${healthFilter === h ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500'}`}
            >
              {h ? h.replace('_', ' ') : 'All health'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {stages.map((stage) => (
          <div
            key={stage.key}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const dealId = e.dataTransfer.getData('text/plain');
              if (dealId) changeStage.mutate({ dealId, stageKey: stage.key });
              setDragging(null);
            }}
            className="flex w-72 shrink-0 flex-col rounded-xl bg-gray-100/70 p-2"
          >
            <div className="mb-2 flex items-center justify-between px-1.5 pt-1">
              <span className="text-sm font-semibold text-gray-700">{stage.label}</span>
              <span className="text-xs text-gray-400">{byStage(stage.key).length}</span>
            </div>
            <p className="mb-2 px-1.5 text-xs text-gray-400">${stageTotal(stage.key).toLocaleString()}</p>
            <div className="flex-1 space-y-2">
              {byStage(stage.key).map((deal) => (
                <DealCard key={deal._id} deal={deal} dragging={dragging === deal._id} onDragStart={() => setDragging(deal._id)} onClick={() => navigate(`/deals/${deal._id}`)} />
              ))}
              {byStage(stage.key).length === 0 && <p className="px-1.5 py-4 text-center text-xs text-gray-400">No deals</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DealCard({ deal, dragging, onDragStart, onClick }: { deal: Deal; dragging: boolean; onDragStart: () => void; onClick: () => void }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', deal._id);
        onDragStart();
      }}
      onClick={onClick}
      className={`cursor-pointer rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-opacity hover:border-brand-300 ${dragging ? 'opacity-40' : ''}`}
    >
      <p className="text-sm font-medium text-gray-900 line-clamp-1">{deal.name}</p>
      <p className="text-xs text-gray-500">{deal.company?.name}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800">${deal.value.toLocaleString()}</span>
        {deal.aiScore && <Badge tone={healthTone(deal.aiScore.health)}>{deal.aiScore.probability}%</Badge>}
      </div>
      <p className="mt-1 text-xs text-gray-400">{deal.owner?.name}</p>
    </div>
  );
}
