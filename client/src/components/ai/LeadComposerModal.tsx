import { useEffect, useState } from 'react';
import { Sparkles, Copy, RotateCw } from 'lucide-react';
import Modal from '../Modal';
import Button from '../Button';
import { useGenerateEmail, useGenerateWhatsApp } from '../../api/ai';

/** Content generation for a lead (no deal exists yet), so no send/approve flow — draft, copy, and follow up manually or after converting to a deal. */
export default function LeadComposerModal({
  open,
  onClose,
  leadId,
  leadName,
  channel,
}: {
  open: boolean;
  onClose: () => void;
  leadId: string;
  leadName: string;
  channel: 'email' | 'whatsapp';
}) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const generateEmail = useGenerateEmail();
  const generateWhatsApp = useGenerateWhatsApp();
  const generating = generateEmail.isPending || generateWhatsApp.isPending;

  const generate = async () => {
    if (channel === 'email') {
      const result = await generateEmail.mutateAsync({ leadId, purpose: 'follow-up', reason: 'following up on a new lead' });
      setSubject(result.subject);
      setBody(result.body);
    } else {
      const result = await generateWhatsApp.mutateAsync({ leadId, reason: 'following up on a new lead' });
      setBody(result.body);
    }
  };

  useEffect(() => {
    if (open) generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${channel === 'email' ? 'Email' : 'WhatsApp'} draft — ${leadName}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={() => navigator.clipboard.writeText(body)}>
            <Copy size={14} /> Copy
          </Button>
          <Button size="sm" onClick={generate} loading={generating}>
            <RotateCw size={14} /> Regenerate
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
          <Sparkles size={13} /> This lead has no linked deal yet, so this draft is for you to send manually (or convert the lead first).
        </div>
        {channel === 'email' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring" />
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Message</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring" />
        </div>
      </div>
    </Modal>
  );
}
