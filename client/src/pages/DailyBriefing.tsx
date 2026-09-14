import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, Clock, AlertTriangle, Activity as ActivityIcon, ArrowUpRight, MessageSquareText } from 'lucide-react';
import { useDailyBriefing } from '../api/ai';
import { useAuth } from '../stores/AuthContext';
import MetricCard from '../components/MetricCard';
import { SkeletonCard } from '../components/Skeleton';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import Button from '../components/Button';
import Badge, { priorityTone } from '../components/Badge';
import AIComposerModal from '../components/ai/AIComposerModal';

export default function DailyBriefing() {
  const { data, isLoading, isError, refetch } = useDailyBriefing();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [composer, setComposer] = useState<{ dealId: string; dealName: string; channel: 'email' | 'whatsapp' } | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonCard />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }
  if (isError || !data) return <ErrorState onRetry={refetch} />;

  const firstName = data.greetingName || user?.name?.split(' ')[0] || 'there';
  const totalAttention = data.hotLeads.length + data.dueFollowUps.length + data.atRiskDeals.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Good {timeOfDay()}, {firstName}.</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {totalAttention > 0 ? `Here is what needs your attention today.` : `You're all caught up — nothing urgent right now.`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Hot leads" value={data.hotLeads.length} icon={<Flame size={16} />} />
        <MetricCard label="Due follow-ups" value={data.dueFollowUps.length} icon={<Clock size={16} />} />
        <MetricCard label="At-risk deals" value={data.atRiskDeals.length} icon={<AlertTriangle size={16} />} />
        <MetricCard
          label="Pipeline health"
          value={`$${data.pipelineHealth.totalOpenValue.toLocaleString()}`}
          hint={`${data.pipelineHealth.openDealCount} open deals across ${data.pipelineHealth.byStage.length} stages`}
          icon={<ActivityIcon size={16} />}
        />
      </div>

      <BriefingSection title="At-risk deals" icon={<AlertTriangle size={16} className="text-amber-500" />} empty="No at-risk deals right now.">
        {data.atRiskDeals.map((deal) => (
          <div key={deal.dealId} className="flex flex-col gap-2 border-b border-gray-100 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">{deal.dealName}</p>
              <p className="text-xs text-gray-500">
                ${deal.value.toLocaleString()} opportunity{deal.customer ? ` · ${deal.customer}` : ''}
              </p>
              <p className="mt-1 text-xs text-brand-700">
                <strong>AI:</strong> {deal.reason}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={priorityTone(deal.priority)}>{deal.priority}</Badge>
              <Button variant="secondary" size="sm" onClick={() => navigate(`/deals/${deal.dealId}`)}>
                Review <ArrowUpRight size={13} />
              </Button>
              <Button size="sm" onClick={() => setComposer({ dealId: deal.dealId, dealName: deal.dealName, channel: 'email' })}>
                <MessageSquareText size={13} /> Prepare Message
              </Button>
            </div>
          </div>
        ))}
      </BriefingSection>

      <BriefingSection title="Hot leads" icon={<Flame size={16} className="text-red-500" />} empty="No hot leads right now.">
        {data.hotLeads.map((lead) => (
          <div key={lead.leadId} className="flex items-center justify-between border-b border-gray-100 py-3 last:border-0">
            <div>
              <p className="text-sm font-medium text-gray-900">{lead.name}</p>
              <p className="text-xs text-gray-500">{lead.companyName}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="red">Score {lead.score}</Badge>
              <Button variant="secondary" size="sm" onClick={() => navigate(`/leads/${lead.leadId}`)}>
                Review
              </Button>
            </div>
          </div>
        ))}
      </BriefingSection>

      <BriefingSection title="Due follow-ups" icon={<Clock size={16} className="text-blue-500" />} empty="No follow-ups due.">
        {data.dueFollowUps.map((f) => (
          <div key={f.activityId} className="flex items-center justify-between border-b border-gray-100 py-3 last:border-0">
            <div>
              <p className="text-sm font-medium text-gray-900">{f.subject}</p>
              <p className="text-xs text-gray-500">{f.reason}</p>
            </div>
            <Badge tone={priorityTone(f.priority)}>{f.priority}</Badge>
          </div>
        ))}
      </BriefingSection>

      {totalAttention === 0 && (
        <EmptyState title="Nothing needs attention" description="Your pipeline looks healthy. Check back tomorrow, or explore your deals." />
      )}

      {composer && (
        <AIComposerModal
          open
          onClose={() => setComposer(null)}
          dealId={composer.dealId}
          dealName={composer.dealName}
          channel={composer.channel}
          reason="the deal has gone quiet and needs a follow-up"
        />
      )}
    </div>
  );
}

function BriefingSection({ title, icon, children, empty }: { title: string; icon: React.ReactNode; children: React.ReactNode; empty: string }) {
  const isEmpty = Array.isArray(children) ? children.length === 0 : !children;
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-1 flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>
      {isEmpty ? <p className="py-6 text-center text-sm text-gray-400">{empty}</p> : <div>{children}</div>}
    </section>
  );
}

function timeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}
