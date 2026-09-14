import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Mail, MessageCircle, Phone, ListChecks, RotateCw } from 'lucide-react';
import { useDealDetail, useChangeDealStage, useAnalyzeDealFull } from '../../api/dealExtra';
import { useOrganization } from '../../api/misc';
import { tasksApi } from '../../api/resources';
import PageLoader from '../../components/PageLoader';
import ErrorState from '../../components/ErrorState';
import Button from '../../components/Button';
import Badge, { healthTone, priorityTone } from '../../components/Badge';
import ActivityTimeline from '../../components/ActivityTimeline';
import AIComposerModal from '../../components/ai/AIComposerModal';
import CallScriptModal from '../../components/ai/CallScriptModal';
import { useToast } from '../../stores/ToastContext';

export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [composer, setComposer] = useState<'email' | 'whatsapp' | null>(null);
  const [callScriptOpen, setCallScriptOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useDealDetail(id);
  const { data: org } = useOrganization();
  const changeStage = useChangeDealStage();
  const analyze = useAnalyzeDealFull();
  const createTask = tasksApi.useCreate();

  if (isLoading) return <PageLoader />;
  if (isError || !data) return <ErrorState onRetry={refetch} />;

  const { deal, activities, conversations, tasks } = data;
  const score = deal.aiScore;

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/deals')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={14} /> Back to deals
      </button>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{deal.name}</h1>
            <p className="text-sm text-gray-500">{deal.company?.name || 'No company linked'}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-gray-900">${deal.value.toLocaleString()}</p>
            {score && <Badge tone={healthTone(score.health)}>{score.probability}% AI close probability</Badge>}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select
            value={deal.stageKey}
            onChange={(e) => changeStage.mutate({ dealId: deal._id, stageKey: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus-ring"
          >
            {org?.dealStages.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <Button variant="secondary" size="sm" onClick={() => analyze.mutate(deal._id)} loading={analyze.isPending}>
            <RotateCw size={13} /> Refresh AI analysis
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/assistant', { state: { prefill: `Why is ${deal.name} at risk?` } })}
          >
            <Sparkles size={13} /> Ask AI about this deal
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {score && (
            <section className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">AI deal analysis</h2>
                <Badge tone={healthTone(score.health)}>{score.health.replace('_', ' ')}</Badge>
              </div>
              <p className="text-sm text-gray-600">{score.explanation}</p>
              <div className="mt-3 space-y-2">
                {score.factors.map((f) => (
                  <div key={f.key}>
                    <div className="mb-1 flex justify-between text-xs text-gray-500">
                      <span>{f.label}</span>
                      <span>
                        {f.contribution >= 0 ? '+' : ''}
                        {f.contribution}% of {f.weight}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100">
                      <div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${Math.min((f.contribution / f.weight) * 100, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg bg-brand-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Recommended action</p>
                <p className="mt-0.5 text-sm text-brand-800">{score.recommendation}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setComposer('email')}>
                  <Mail size={13} /> Prepare follow-up
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setComposer('whatsapp')}>
                  <MessageCircle size={13} /> Prepare WhatsApp
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setCallScriptOpen(true)}>
                  <Phone size={13} /> Call script
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    await createTask.mutateAsync({ title: `Follow up: ${deal.name}`, deal: deal._id, assignedTo: deal.owner._id, priority: 'medium' } as never);
                    await refetch(); // the created task lives in this page's /detail query, not the generic tasks list
                    toast.show('Task created', 'success');
                  }}
                  loading={createTask.isPending}
                >
                  <ListChecks size={13} /> Create task
                </Button>
              </div>
            </section>
          )}

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Activity timeline</h2>
            <ActivityTimeline activities={activities} />
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Conversations</h2>
            {conversations.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">No conversations logged yet.</p>
            ) : (
              <div className="space-y-3">
                {conversations.map((c) => (
                  <div key={c._id} className="rounded-lg border border-gray-100 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium uppercase text-gray-500">
                        {c.channel} · {c.direction}
                      </span>
                      <span className="text-xs text-gray-400">{new Date(c.occurredAt).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-700">{c.content}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Overview</h2>
            <dl className="space-y-2 text-sm">
              <Row label="Owner" value={deal.owner?.name} />
              <Row label="Contact" value={deal.primaryContact?.name || '—'} />
              <Row label="Source" value={deal.source || '—'} />
              <Row label="Expected close" value={deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString() : '—'} />
              <Row label="Currency" value={deal.currency} />
            </dl>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Tasks</h2>
            {tasks.length === 0 ? (
              <p className="py-2 text-center text-sm text-gray-400">No tasks linked to this deal.</p>
            ) : (
              <div className="space-y-2">
                {tasks.map((t) => (
                  <div key={t._id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{t.title}</span>
                    <Badge tone={priorityTone(t.priority)}>{t.priority}</Badge>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {composer && (
        <AIComposerModal
          open
          onClose={() => setComposer(null)}
          dealId={deal._id}
          dealName={deal.name}
          contactId={deal.primaryContact?._id}
          channel={composer}
          reason={score?.explanation}
        />
      )}
      <CallScriptModal
        open={callScriptOpen}
        onClose={() => setCallScriptOpen(false)}
        dealId={deal._id}
        dealName={deal.name}
        contactId={deal.primaryContact?._id}
        reason={score?.explanation}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value || '—'}</dd>
    </div>
  );
}
