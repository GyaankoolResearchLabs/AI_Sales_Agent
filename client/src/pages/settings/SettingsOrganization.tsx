import { useEffect, useState } from 'react';
import { useOrganization, useUpdateOrganization } from '../../api/misc';
import Button from '../../components/Button';
import PageLoader from '../../components/PageLoader';
import { useToast } from '../../stores/ToastContext';

export default function SettingsOrganization() {
  const { data: org, isLoading } = useOrganization();
  const update = useUpdateOrganization();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', industry: '', businessModel: '', companySize: '', salesTeamSize: '', productType: '' });

  useEffect(() => {
    if (org) {
      setForm({
        name: org.name,
        industry: org.industry,
        businessModel: org.businessModel,
        companySize: org.companySize,
        salesTeamSize: org.salesTeamSize,
        productType: org.productType,
      });
    }
  }, [org]);

  if (isLoading) return <PageLoader />;

  const submit = async () => {
    try {
      await update.mutateAsync(form);
      toast.show('Organization updated', 'success');
    } catch {
      toast.show('Could not update organization', 'error');
    }
  };

  return (
    <div className="max-w-lg space-y-3 rounded-xl border border-gray-200 bg-white p-5">
      <Field label="Organization name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Industry</label>
          <select value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring">
            {['SaaS', 'Real Estate', 'Consulting', 'Manufacturing', 'Other'].map((i) => (
              <option key={i}>{i}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Business model</label>
          <select value={form.businessModel} onChange={(e) => setForm({ ...form, businessModel: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring">
            {['B2B', 'B2C', 'B2B2C', 'Marketplace', 'Other'].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>
      <Field label="Company size" value={form.companySize} onChange={(v) => setForm({ ...form, companySize: v })} />
      <Field label="Sales team size" value={form.salesTeamSize} onChange={(v) => setForm({ ...form, salesTeamSize: v })} />
      <Field label="Product/service type" value={form.productType} onChange={(v) => setForm({ ...form, productType: v })} />
      <div className="flex justify-end pt-1">
        <Button onClick={submit} loading={update.isPending}>
          Save changes
        </Button>
      </div>
    </div>
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
