import { useEffect, useState } from 'react';
import { Sparkles, Copy, Send, RotateCw } from 'lucide-react';
import Modal from '../Modal';
import Button from '../Button';
import { useGenerateEmailDraft, useGenerateWhatsAppDraft } from '../../api/content';
import { useCreateQuickRecommendation, useApproveRecommendation, useExecuteRecommendation } from '../../api/recommendations';
import { useToast } from '../../stores/ToastContext';

interface AIComposerModalProps {
  open: boolean;
  onClose: () => void;
  dealId: string;
  dealName: string;
  contactId?: string;
  channel: 'email' | 'whatsapp';
  reason?: string;
}

type Tone = 'professional' | 'friendly' | 'concise';

/**
 * Generation goes through the real, persisted content-generation endpoints
 * (/api/content/email|whatsapp — Phase 5), so every draft shown here is an
 * actual ContentDraft document, not a throwaway string. Sending still goes
 * through the recommendation approve/execute flow, which is what actually
 * performs delivery via the integration provider layer.
 */
export default function AIComposerModal({ open, onClose, dealId, dealName, contactId, channel, reason }: AIComposerModalProps) {
  const [draftId, setDraftId] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [tone, setTone] = useState<Tone>('professional');
  const [sent, setSent] = useState(false);
  const toast = useToast();

  const generateEmail = useGenerateEmailDraft();
  const generateWhatsApp = useGenerateWhatsAppDraft();
  const createQuick = useCreateQuickRecommendation();
  const approve = useApproveRecommendation();
  const execute = useExecuteRecommendation();

  const generating = generateEmail.isPending || generateWhatsApp.isPending;
  const sending = createQuick.isPending || approve.isPending || execute.isPending;

  const generate = async (nextTone: Tone = tone) => {
    if (channel === 'email') {
      const draft = await generateEmail.mutateAsync({ dealId, contactId, purpose: 'follow-up', tone: nextTone, reason });
      setDraftId(draft._id);
      setSubject((draft.content as { subject?: string }).subject ?? '');
      setBody((draft.content as { body?: string }).body ?? '');
    } else {
      const draft = await generateWhatsApp.mutateAsync({ dealId, contactId, reason });
      setDraftId(draft._id);
      setBody((draft.content as { body?: string }).body ?? '');
    }
  };

  useEffect(() => {
    if (open) {
      setSent(false);
      setDraftId(null);
      generate(tone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, channel]);

  const send = async () => {
    try {
      const rec = await createQuick.mutateAsync({
        dealId,
        channel,
        title: channel === 'email' ? `Follow-up email — ${dealName}` : `WhatsApp follow-up — ${dealName}`,
        reason: reason || 'Prepared from the deal workspace',
        subject: channel === 'email' ? subject : undefined,
        body,
      });
      if (rec.permissionRequirement === 'approval_required') {
        await approve.mutateAsync(rec._id);
      }
      const result = await execute.mutateAsync(rec._id);
      if (result.outcome.success) {
        toast.show(`${channel === 'email' ? 'Email' : 'WhatsApp message'} sent (development mode logs the send).`, 'success');
        setSent(true);
      } else {
        toast.show(result.outcome.error || 'Could not send — check contact details.', 'error');
      }
    } catch {
      toast.show('Something went wrong preparing this action', 'error');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${channel === 'email' ? 'Email' : 'WhatsApp'} — ${dealName}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={() => navigator.clipboard.writeText(body)}>
            <Copy size={14} /> Copy
          </Button>
          <Button variant="secondary" size="sm" onClick={() => generate()} loading={generating}>
            <RotateCw size={14} /> Regenerate
          </Button>
          <Button size="sm" onClick={send} loading={sending} disabled={sent}>
            <Send size={14} /> {sent ? 'Sent' : 'Approve & Send'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
          <Sparkles size={13} /> AI-generated draft using real deal &amp; contact context. Review before sending.
          {draftId && <span className="ml-auto text-[10px] text-brand-400">draft {draftId.slice(-6)}</span>}
        </div>

        <div className="flex gap-1.5">
          {(['professional', 'friendly', 'concise'] as Tone[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTone(t);
                generate(t);
              }}
              className={`rounded-full border px-2.5 py-1 text-xs capitalize ${
                tone === t ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {channel === 'email' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring" />
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={channel === 'email' ? 8 : 4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring"
          />
        </div>
      </div>
    </Modal>
  );
}
