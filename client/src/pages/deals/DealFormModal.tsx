import { useState } from 'react';
import Modal from '../../components/Modal';
import Button from '../../components/Button';
import { dealsApi, companiesApi, contactsApi } from '../../api/resources';
import { useOrganization } from '../../api/misc';
import { useToast } from '../../stores/ToastContext';

export default function DealFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', company: '', primaryContact: '', value: 0, stageKey: '', expectedCloseDate: '' });
  const create = dealsApi.useCreate();
  const { data: org } = useOrganization();
  const { data: companies } = companiesApi.useList({ limit: 100 }, { enabled: open });
  const { data: contacts } = contactsApi.useList({ limit: 100 }, { enabled: open });
  const toast = useToast();

  const submit = async () => {
    try {
      await create.mutateAsync({
        ...form,
        company: form.company || undefined,
        primaryContact: form.primaryContact || undefined,
        stageKey: form.stageKey || org?.dealStages[0]?.key,
        expectedCloseDate: form.expectedCloseDate || undefined,
      } as never);
      toast.show('Deal created', 'success');
      setForm({ name: '', company: '', primaryContact: '', value: 0, stageKey: '', expectedCloseDate: '' });
      onClose();
    } catch {
      toast.show('Could not create deal', 'error');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New deal"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} loading={create.isPending} disabled={!form.name}>
            Create deal
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Deal name *</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Value ($)</label>
            <input
              type="number"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Stage</label>
            <select value={form.stageKey} onChange={(e) => setForm({ ...form, stageKey: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring">
              <option value="">Default</option>
              {org?.dealStages.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Company</label>
          <select value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring">
            <option value="">None</option>
            {companies?.items.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Primary contact</label>
          <select value={form.primaryContact} onChange={(e) => setForm({ ...form, primaryContact: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring">
            <option value="">None</option>
            {contacts?.items.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Expected close date</label>
          <input
            type="date"
            value={form.expectedCloseDate}
            onChange={(e) => setForm({ ...form, expectedCloseDate: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring"
          />
        </div>
      </div>
    </Modal>
  );
}
