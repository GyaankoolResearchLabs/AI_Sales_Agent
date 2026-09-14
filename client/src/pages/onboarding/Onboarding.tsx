import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../stores/AuthContext';
import { useOnboardingStep1, useOnboardingStep2, useGenerateWorkflow, useCompleteOnboarding } from '../../api/onboarding';
import Button from '../../components/Button';
import ImportStep from './ImportStep';

const STEPS = ['Business', 'Sales process', 'Generate workflow', 'Import data'];
const INDUSTRIES = ['SaaS', 'Real Estate', 'Consulting', 'Manufacturing', 'Other'];

export default function Onboarding() {
  const { organization, setOrganization, refreshMe } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const [step1, setStep1] = useState({
    industry: organization?.industry || 'SaaS',
    customIndustry: '',
    businessModel: organization?.businessModel || 'B2B',
    companySize: organization?.companySize || '1-10',
    salesTeamSize: organization?.salesTeamSize || '1-5',
    productType: organization?.productType || '',
  });

  const [step2, setStep2] = useState({
    averageDealSize: 25000,
    salesCycleDays: 30,
    commonObjections: 'Price is too high\nNeed to think about it\nHappy with current solution',
    qualificationCriteria: 'Budget confirmed\nDecision maker identified\nTimeline within 2 quarters',
  });

  const [generatedOrg, setGeneratedOrg] = useState(organization);

  const s1 = useOnboardingStep1();
  const s2 = useOnboardingStep2();
  const gen = useGenerateWorkflow();
  const complete = useCompleteOnboarding();

  const submitStep1 = async () => {
    const org = await s1.mutateAsync(step1);
    setOrganization(org);
    setStep(1);
  };

  const submitStep2 = async () => {
    const org = await s2.mutateAsync({
      averageDealSize: step2.averageDealSize,
      salesCycleDays: step2.salesCycleDays,
      commonObjections: step2.commonObjections.split('\n').filter(Boolean),
      qualificationCriteria: step2.qualificationCriteria.split('\n').filter(Boolean),
    });
    setOrganization(org);
    setStep(2);
  };

  const submitGenerate = async () => {
    const org = await gen.mutateAsync();
    setOrganization(org);
    setGeneratedOrg(org);
    setStep(3);
  };

  const finish = async () => {
    await complete.mutateAsync();
    await refreshMe();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Bot size={20} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Set up your AI Sales workspace</h1>
            <p className="text-sm text-gray-500">A few quick questions so the AI understands your business</p>
          </div>
        </div>

        <div className="mb-6 flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  i < step ? 'bg-brand-600 text-white' : i === step ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-600' : 'bg-gray-100 text-gray-400'
                }`}
              >
                {i < step ? <Check size={13} /> : i + 1}
              </div>
              <span className={`hidden sm:block text-xs font-medium ${i <= step ? 'text-gray-700' : 'text-gray-400'}`}>{label}</span>
              {i < STEPS.length - 1 && <div className="h-px flex-1 bg-gray-200" />}
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">Tell us about your business</h2>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Industry</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {INDUSTRIES.map((ind) => (
                    <button
                      key={ind}
                      onClick={() => setStep1({ ...step1, industry: ind })}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        step1.industry === ind ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {ind}
                    </button>
                  ))}
                </div>
                {step1.industry === 'Other' && (
                  <input
                    placeholder="Describe your industry"
                    value={step1.customIndustry}
                    onChange={(e) => setStep1({ ...step1, customIndustry: e.target.value })}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring"
                  />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Business model</label>
                  <select
                    value={step1.businessModel}
                    onChange={(e) => setStep1({ ...step1, businessModel: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring"
                  >
                    {['B2B', 'B2C', 'B2B2C', 'Marketplace', 'Other'].map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Company size</label>
                  <select
                    value={step1.companySize}
                    onChange={(e) => setStep1({ ...step1, companySize: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring"
                  >
                    {['1-10', '11-50', '51-200', '201-1000', '1000+'].map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Sales team size</label>
                  <select
                    value={step1.salesTeamSize}
                    onChange={(e) => setStep1({ ...step1, salesTeamSize: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring"
                  >
                    {['1-5', '6-10', '11-25', '26-100', '100+'].map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Product/service type</label>
                  <input
                    value={step1.productType}
                    onChange={(e) => setStep1({ ...step1, productType: e.target.value })}
                    placeholder="e.g. Subscription software"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={submitStep1} loading={s1.isPending}>
                  Continue <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">Your sales process</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Average deal size ($)</label>
                  <input
                    type="number"
                    value={step2.averageDealSize}
                    onChange={(e) => setStep2({ ...step2, averageDealSize: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Sales cycle (days)</label>
                  <input
                    type="number"
                    value={step2.salesCycleDays}
                    onChange={(e) => setStep2({ ...step2, salesCycleDays: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Common objections (one per line)</label>
                <textarea
                  value={step2.commonObjections}
                  onChange={(e) => setStep2({ ...step2, commonObjections: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Qualification criteria (one per line)</label>
                <textarea
                  value={step2.qualificationCriteria}
                  onChange={(e) => setStep2({ ...step2, qualificationCriteria: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring"
                />
              </div>
              <div className="flex justify-between pt-2">
                <Button variant="secondary" onClick={() => setStep(0)}>
                  <ArrowLeft size={14} /> Back
                </Button>
                <Button onClick={submitStep2} loading={s2.isPending}>
                  Continue <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">Generate your sales workflow</h2>
              <p className="text-sm text-gray-500">
                Based on your answers, we'll set up deal stages, activity types, and custom fields automatically. You can edit all of this later
                in Settings.
              </p>
              {!generatedOrg?.dealStages?.length ? (
                <div className="flex justify-end pt-2">
                  <Button onClick={submitGenerate} loading={gen.isPending}>
                    Generate workflow
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Deal stages</p>
                    <div className="flex flex-wrap gap-1.5">
                      {generatedOrg.dealStages.map((s) => (
                        <span key={s.key} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                          {s.label} ({s.probability}%)
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Activity types</p>
                    <div className="flex flex-wrap gap-1.5">
                      {generatedOrg.activityTypes.map((a) => (
                        <span key={a.key} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                          {a.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between pt-2">
                    <Button variant="secondary" onClick={() => setStep(1)}>
                      <ArrowLeft size={14} /> Back
                    </Button>
                    <Button onClick={() => setStep(3)}>
                      Continue <ArrowRight size={14} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && <ImportStep onBack={() => setStep(2)} onFinish={finish} finishing={complete.isPending} />}
        </div>
      </div>
    </div>
  );
}
