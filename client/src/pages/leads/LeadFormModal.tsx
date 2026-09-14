import { useState } from 'react';
import Modal from '../../components/Modal';
import Button from '../../components/Button';
import { leadsApi } from '../../api/resources';
import { useToast } from '../../stores/ToastContext';

export default function LeadFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', companyName: '', jobTitle: '', phone: '', source: 'manual' });
  const create = leadsApi.useCreate();
  const toast = useToast();

  const submit = async () => {
    try {
      await create.mutateAsync(form);
      toast.show('Lead created', 'success');
      setForm({ name: '', email: '', companyName: '', jobTitle: '', phone: '', source: 'manual' });
      onClose();
    } catch {
      toast.show('Could not create lead', 'error');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New lead"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} loading={create.isPending} disabled={!form.name}>
            Create lead
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        <Field label="Company" value={form.companyName} onChange={(v) => setForm({ ...form, companyName: v })} />
        <Field label="Job title" value={form.jobTitle} onChange={(v) => setForm({ ...form, jobTitle: v })} />
        <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
      </div>
    </Modal>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring" />
    </div>
  );
}
