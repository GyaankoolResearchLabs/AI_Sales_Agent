import { useEffect } from 'react';
import { Copy, RotateCw } from 'lucide-react';
import Modal from '../Modal';
import Button from '../Button';
import { useGenerateCallScript } from '../../api/ai';

export default function CallScriptModal({
  open,
  onClose,
  dealId,
  dealName,
  contactId,
  reason,
}: {
  open: boolean;
  onClose: () => void;
  dealId: string;
  dealName: string;
  contactId?: string;
  reason?: string;
}) {
  const generate = useGenerateCallScript();

  useEffect(() => {
    if (open) generate.mutate({ dealId, contactId, reason });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const script = generate.data;

  const fullText = script
    ? [
        `Opening: ${script.opening}`,
        `Context: ${script.context}`,
        `Discovery questions:\n${script.discoveryQuestions.map((q) => `- ${q}`).join('\n')}`,
        `Objection handling:\n${script.objectionHandling.map((o) => `- "${o.objection}" → ${o.response}`).join('\n')}`,
        `Closing: ${script.closing}`,
      ].join('\n\n')
    : '';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Call script — ${dealName}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={() => navigator.clipboard.writeText(fullText)}>
            <Copy size={14} /> Copy
          </Button>
          <Button variant="secondary" size="sm" onClick={() => generate.mutate({ dealId, contactId, reason })} loading={generate.isPending}>
            <RotateCw size={14} /> Regenerate
          </Button>
        </>
      }
    >
      {generate.isPending && <p className="py-8 text-center text-sm text-gray-400">Preparing script…</p>}
      {script && (
        <div className="space-y-4 text-sm">
          <Section label="Opening">{script.opening}</Section>
          <Section label="Context">{script.context}</Section>
          <Section label="Discovery questions">
            <ul className="list-disc space-y-1 pl-4">
              {script.discoveryQuestions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </Section>
          <Section label="Objection handling">
            <div className="space-y-2">
              {script.objectionHandling.map((o, i) => (
                <div key={i} className="rounded-lg bg-gray-50 p-2.5">
                  <p className="font-medium text-gray-700">"{o.objection}"</p>
                  <p className="mt-0.5 text-gray-600">{o.response}</p>
                </div>
              ))}
            </div>
          </Section>
          <Section label="Closing">{script.closing}</Section>
        </div>
      )}
    </Modal>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <div className="text-gray-700">{children}</div>
    </div>
  );
}
