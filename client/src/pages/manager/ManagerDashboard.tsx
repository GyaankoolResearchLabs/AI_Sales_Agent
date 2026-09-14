import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useManagerDashboard } from '../../api/misc';
import MetricCard from '../../components/MetricCard';
import PageLoader from '../../components/PageLoader';
import ErrorState from '../../components/ErrorState';

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
];

export default function ManagerDashboard() {
  const [range, setRange] = useState('30d');
  const { data, isLoading, isError, refetch } = useManagerDashboard(range);

  if (isLoading) return <PageLoader />;
  if (isError || !data) return <ErrorState onRetry={refetch} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Manager Dashboard</h1>
          <p className="text-sm text-gray-500">Team pipeline, forecast, and rep productivity — computed live.</p>
        </div>
        <div className="flex gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${range === r.key ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Team pipeline" value={`$${data.pipeline.totalValue.toLocaleString()}`} hint={`${data.pipeline.totalCount} open deals`} />
        <MetricCard label="Win rate" value={`${data.winRate}%`} hint="Deals closed in range" />
        <MetricCard label="Revenue forecast" value={`$${data.revenueForecast.toLocaleString()}`} />
        <MetricCard label="Avg. deal velocity" value={data.avgVelocityDays !== null ? `${data.avgVelocityDays} days` : '—'} hint="Creation to won" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard label="At-risk deals" value={data.atRiskDeals} className="border-amber-200" />
        <MetricCard label="Stalled deals" value={data.stalledDeals} className="border-red-200" />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Pipeline by stage</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.pipeline.byStage}>
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
            <Bar dataKey="value" fill="#6366f1" radius={4} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Pipeline by rep</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500">
                <th className="py-2">Rep</th>
                <th className="py-2">Pipeline value</th>
                <th className="py-2">Open deals</th>
                <th className="py-2">Won</th>
                <th className="py-2">Lost</th>
              </tr>
            </thead>
            <tbody>
              {data.byRep.map((r) => (
                <tr key={r.name} className="border-b border-gray-50">
                  <td className="py-2 font-medium text-gray-900">{r.name}</td>
                  <td className="py-2">${r.pipelineValue.toLocaleString()}</td>
                  <td className="py-2">{r.dealCount}</td>
                  <td className="py-2 text-emerald-600">{r.won}</td>
                  <td className="py-2 text-red-600">{r.lost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
