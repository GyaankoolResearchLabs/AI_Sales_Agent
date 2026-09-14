import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useForecast } from '../../api/ai';
import MetricCard from '../../components/MetricCard';
import PageLoader from '../../components/PageLoader';
import ErrorState from '../../components/ErrorState';

interface ForecastGroup {
  label: string;
  value: number;
  weighted: number;
  count: number;
}
interface ForecastData {
  methodology: string;
  pipelineValue: number;
  weightedPipeline: number;
  expectedRevenue: number;
  bestCase: number;
  commit: number;
  dealCount: number;
  groups: ForecastGroup[];
}

export default function Forecast() {
  const [groupBy, setGroupBy] = useState<'rep' | 'stage' | 'month'>('stage');
  const { data, isLoading, isError, refetch } = useForecast(groupBy);
  const forecast = data as unknown as ForecastData | undefined;

  if (isLoading) return <PageLoader />;
  if (isError || !forecast) return <ErrorState onRetry={refetch} />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Forecast</h1>
        <p className="text-sm text-gray-500">{forecast.methodology}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Pipeline value" value={`$${forecast.pipelineValue.toLocaleString()}`} hint={`${forecast.dealCount} open deals`} />
        <MetricCard label="Weighted pipeline" value={`$${forecast.weightedPipeline.toLocaleString()}`} />
        <MetricCard label="Best case" value={`$${forecast.bestCase.toLocaleString()}`} />
        <MetricCard label="Commit" value={`$${forecast.commit.toLocaleString()}`} hint="Deals with ≥70% probability" />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Forecast by</h2>
          <div className="flex gap-1.5">
            {(['stage', 'rep', 'month'] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`rounded-full border px-2.5 py-1 text-xs capitalize ${groupBy === g ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500'}`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={forecast.groups}>
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
            <Bar dataKey="value" name="Pipeline value" fill="#c7d2fe" radius={4} />
            <Bar dataKey="weighted" name="Weighted (expected revenue)" fill="#6366f1" radius={4} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
