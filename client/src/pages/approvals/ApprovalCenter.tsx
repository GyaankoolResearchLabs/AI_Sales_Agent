import { useState } from 'react';
import { Check, X, Bot, Zap } from 'lucide-react';
import { useApprovals, useApproveApproval, useRejectApproval, Approval, PermissionCategory } from '../../api/approvals';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import EmptyState from '../../components/EmptyState';
import Modal from '../../components/Modal';
import { SkeletonRows } from '../../components/Skeleton';
import { useToast } from '../../stores/ToastContext';
import { extractErrorMessage } from '../../api/http';

const PERMISSION_LABEL: Record<PermissionCategory, string> = {
  emailSending: 'Email sending',
  whatsappSending: 'WhatsApp sending',
  crmUpdates: 'CRM updates',
  meetingScheduling: 'Meeting scheduling',
  proposalCreation: 'Proposal creation',
  taskCreation: 'Task creation',
};

const STATUS_TABS: { key: '' | 'pending' | 'approved' | 'rejected'; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: '', label: 'All' },
];

export default function ApprovalCenter() {
  const [status, setStatus] = useState<'' | 'pending' | 'approved' | 'rejected'>('pending');
  const { data, isLoading } = useApprovals(status);
  const [rejecting, setRejecting] = useState<Approval | null>(null);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Approval Center</h1>
        <p className="text-sm text-gray-500">Review what the AI wants to do before it happens — nothing is sent without your say.</p>
      </div>

      <div className="flex gap-1.5">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key || 'all'}
            onClick={() => setStatus(t.key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${status === t.key ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <SkeletonRows rows={4} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState title="Nothing here" description="AI-proposed actions from anomaly detection will appear here for review before they happen." />
      ) : (
        <div className="space-y-3">
          {data!.map((approval) => (
            <ApprovalCard key={approval._id} approval={approval} onReject={() => setRejecting(approval)} />
          ))}
        </div>
      )}

      {rejecting && <RejectModal approval={rejecting} onClose={() => setRejecting(null)} />}
    </div>
  );
}

function ApprovalCard({ approval, onReject }: { approval: Approval; onReject: () => void }) {
  const approve = useApproveApproval();
  const toast = useToast();

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600">
            {approval.autoExecuted ? <Zap size={15} /> : <Bot size={15} />}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{approval.title}</p>
            <p className="text-xs text-gray-500">
              {approval.deal?.name ? `${approval.deal.name}${approval.deal.value ? ` · $${approval.deal.value.toLocaleString()}` : ''} · ` : ''}
              Confidence {approval.confidence}%
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Badge tone="blue">{PERMISSION_LABEL[approval.permissionCategory]}</Badge>
          <Badge tone={approval.status === 'approved' ? 'green' : approval.status === 'rejected' ? 'red' : 'amber'}>
            {approval.autoExecuted ? 'Auto-executed' : approval.status}
          </Badge>
        </div>
      </div>

      <p className="mt-2 text-sm text-gray-600">
        <span className="font-medium text-gray-500">Why: </span>
        {approval.reason}
      </p>

      {approval.contentDraft && (
        <div className="mt-3 rounded-lg bg-gray-50 p-3">
          {typeof approval.contentDraft.content === 'object' && 'subject' in approval.contentDraft.content && (
            <p className="mb-1 text-xs font-medium text-gray-500">Subject: {String((approval.contentDraft.content as { subject?: string }).subject)}</p>
          )}
          <p className="whitespace-pre-wrap text-sm text-gray-700">
            {String((approval.contentDraft.content as { body?: string }).body ?? (approval.contentDraft.content as { content?: string }).content ?? '')}
          </p>
        </div>
      )}

      {approval.status === 'rejected' && approval.rejectedReason && (
        <p className="mt-2 text-xs text-red-600">
          <span className="font-medium">Rejected:</span> {approval.rejectedReason}
        </p>
      )}
      {approval.status === 'approved' && approval.decidedBy && (
        <p className="mt-2 text-xs text-emerald-600">Approved by {approval.decidedBy.name}</p>
      )}

      {approval.status === 'pending' && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={async () => {
              try {
                const result = await approve.mutateAsync(approval._id);
                const send = result.sendResult;
                if (!send || !send.attempted) {
                  toast.show('Approved', 'success');
                } else if (send.success) {
                  toast.show(`Approved and sent via ${send.provider} (${send.environment}).`, 'success');
                } else {
                  toast.show(`Approved, but sending failed via ${send.provider ?? 'the configured provider'}: ${send.error}`, 'error');
                }
              } catch (err) {
                toast.show(extractErrorMessage(err), 'error');
              }
            }}
            loading={approve.isPending}
          >
            <Check size={13} /> Approve
          </Button>
          <Button variant="danger" size="sm" onClick={onReject}>
            <X size={13} /> Reject
          </Button>
        </div>
      )}
    </div>
  );
}

function RejectModal({ approval, onClose }: { approval: Approval; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const reject = useRejectApproval();
  const toast = useToast();

  const submit = async () => {
    if (!reason.trim()) return;
    try {
      await reject.mutateAsync({ id: approval._id, reason: reason.trim() });
      toast.show('Rejected', 'info');
      onClose();
    } catch (err) {
      toast.show(extractErrorMessage(err), 'error');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Reject: ${approval.title}`}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={submit} loading={reject.isPending} disabled={!reason.trim()}>
            Reject
          </Button>
        </>
      }
    >
      <label className="mb-1 block text-xs font-medium text-gray-600">Reason (required)</label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="Why isn't this the right action right now?"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring"
        autoFocus
      />
    </Modal>
  );
}
