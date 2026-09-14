import { useEffect, useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { useOrganization, useUpdateDealStages } from '../../api/misc';
import Button from '../../components/Button';
import PageLoader from '../../components/PageLoader';
import { useToast } from '../../stores/ToastContext';
import { DealStageConfig } from '../../types';

export default function SettingsSalesProcess() {
  const { data: org, isLoading } = useOrganization();
  const updateStages = useUpdateDealStages();
  const toast = useToast();
  const [stages, setStages] = useState<DealStageConfig[]>([]);

  useEffect(() => {
    if (org) setStages(org.dealStages);
  }, [org]);

  if (isLoading) return <PageLoader />;

  const update = (i: number, patch: Partial<DealStageConfig>) => {
    setStages((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };

  const addStage = () => {
    setStages((prev) => [...prev, { key: `stage_${Date.now()}`, label: 'New stage', order: prev.length, probability: 50, isWon: false, isLost: false }]);
  };

  const removeStage = (i: number) => setStages((prev) => prev.filter((_, idx) => idx !== i));

  const save = async () => {
    try {
      await updateStages.mutateAsync(stages.map((s, i) => ({ ...s, order: i })));
      toast.show('Sales process updated', 'success');
    } catch {
      toast.show('Could not save stages', 'error');
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Deal stages</h2>
          <Button variant="secondary" size="sm" onClick={addStage}>
            <Plus size={13} /> Add stage
          </Button>
        </div>
        <div className="space-y-2">
          {stages.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2 rounded-lg border border-gray-100 p-2">
              <GripVertical size={14} className="text-gray-300" />
              <input value={s.label} onChange={(e) => update(i, { label: e.target.value })} className="flex-1 rounded border border-gray-200 px-2 py-1 text-sm" />
              <input
                type="number"
                value={s.probability}
                onChange={(e) => update(i, { probability: Number(e.target.value) })}
                className="w-16 rounded border border-gray-200 px-2 py-1 text-sm"
              />
              <span className="text-xs text-gray-400">%</span>
              <label className="flex items-center gap-1 text-xs text-gray-500">
                <input type="checkbox" checked={s.isWon} onChange={(e) => update(i, { isWon: e.target.checked, isLost: false })} /> Won
              </label>
              <label className="flex items-center gap-1 text-xs text-gray-500">
                <input type="checkbox" checked={s.isLost} onChange={(e) => update(i, { isLost: e.target.checked, isWon: false })} /> Lost
              </label>
              <button onClick={() => removeStage(i)} className="text-gray-400 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={save} loading={updateStages.isPending}>
            Save stages
          </Button>
        </div>
      </div>

      {org && (org.commonObjections?.length || org.qualificationCriteria?.length) ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">Qualification criteria &amp; objections</h2>
          <p className="mb-1 text-xs font-medium text-gray-500">Qualification criteria</p>
          <ul className="mb-3 list-disc pl-4 text-sm text-gray-600">
            {org.qualificationCriteria?.map((q) => <li key={q}>{q}</li>)}
          </ul>
          <p className="mb-1 text-xs font-medium text-gray-500">Common objections</p>
          <ul className="list-disc pl-4 text-sm text-gray-600">
            {org.commonObjections?.map((q) => <li key={q}>{q}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
