import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, MessageCircle, RotateCw, Trash2 } from 'lucide-react';
import { leadsApi } from '../../api/resources';
import { useLeadTimeline, useRescoreLead } from '../../api/leadExtra';
import PageLoader from '../../components/PageLoader';
import ErrorState from '../../components/ErrorState';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import ActivityTimeline from '../../components/ActivityTimeline';
import LeadComposerModal from '../../components/ai/LeadComposerModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useToast } from '../../stores/ToastContext';

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [composer, setComposer] = useState<'email' | 'whatsapp' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: lead, isLoading, isError, refetch } = leadsApi.useGet(id);
  const { data: timeline } = useLeadTimeline(id);
  const rescore = useRescoreLead();
  const remove = leadsApi.useRemove();

  if (isLoading) return <PageLoader />;
  if (isError || !lead) return <ErrorState onRetry={refetch} />;

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/leads')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={14} /> Back to leads
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-5">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{lead.name}</h1>
          <p className="text-sm text-gray-500">
            {lead.jobTitle ? `${lead.jobTitle} · ` : ''}
            {lead.companyName || 'No company'}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Badge tone={lead.score >= 70 ? 'red' : lead.score >= 40 ? 'amber' : 'gray'}>Score {lead.score}</Badge>
            <Badge tone="blue">{lead.status.replace('_', ' ')}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => rescore.mutate(lead._id)} loading={rescore.isPending}>
            <RotateCw size={13} /> Rescore
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setComposer('email')}>
            <Mail size={13} /> Draft email
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setComposer('whatsapp')}>
            <MessageCircle size={13} /> Draft WhatsApp
          </Button>
          <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={13} />
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Activity timeline</h2>
            <ActivityTimeline activities={timeline ?? []} />
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Details</h2>
            <dl className="space-y-2 text-sm">
              <Row label="Email" value={lead.email || '—'} />
              <Row label="Phone" value={lead.phone || '—'} />
              <Row label="Source" value={lead.source || '—'} />
              <Row label="Owner" value={lead.owner?.name || 'Unassigned'} />
            </dl>
          </section>

          {lead.scoreBreakdown && (
            <section className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">AI score breakdown</h2>
              <div className="space-y-2">
                {Object.entries(lead.scoreBreakdown).map(([key, value]) => (
                  <div key={key}>
                    <div className="mb-1 flex justify-between text-xs text-gray-500">
                      <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                      <span>{Math.round(value)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100">
                      <div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${Math.min(value, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {composer && <LeadComposerModal open onClose={() => setComposer(null)} leadId={lead._id} leadName={lead.name} channel={composer} />}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete lead"
        message={`Are you sure you want to delete ${lead.name}? This cannot be undone.`}
        danger
        loading={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await remove.mutateAsync(lead._id);
          toast.show('Lead deleted', 'success');
          navigate('/leads');
        }}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value}</dd>
    </div>
  );
}
