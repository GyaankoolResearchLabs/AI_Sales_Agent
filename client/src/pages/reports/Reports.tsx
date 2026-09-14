import { useState } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Download, Save, Play, Trash2 } from 'lucide-react';
import { useReports, usePreviewReport, useSaveReport, useDeleteReport, ReportDefinition } from '../../api/reports';
import Button from '../../components/Button';
import { useToast } from '../../stores/ToastContext';

const DATASETS: { key: ReportDefinition['dataset']; label: string; fields: string[] }[] = [
  { key: 'deals', label: 'Deals', fields: ['name', 'value', 'stageKey', 'owner', 'createdAt'] },
  { key: 'leads', label: 'Leads', fields: ['name', 'status', 'score', 'source', 'createdAt'] },
  { key: 'activities', label: 'Activities', fields: ['type', 'subject', 'isCompleted', 'createdAt'] },
  { key: 'contacts', label: 'Contacts', fields: ['name', 'email', 'isDecisionMaker', 'createdAt'] },
];

const COLORS = ['#6366f1', '#059669', '#d97706', '#dc2626', '#0ea5e9', '#9333ea'];

export default function Reports() {
  const [def, setDef] = useState<ReportDefinition>({
    name: 'Deals by stage',
    dataset: 'deals',
    fields: ['name', 'value', 'stageKey'],
    filters: [],
    groupBy: 'stageKey',
    metric: 'sum',
    metricField: 'value',
    chartType: 'bar',
  });

  const { data: reports } = useReports();
  const preview = usePreviewReport();
  const save = useSaveReport();
  const del = useDeleteReport();
  const toast = useToast();

  const fields = DATASETS.find((d) => d.key === def.dataset)?.fields ?? [];

  const run = () => preview.mutate(def);

  const chartData = preview.data?.groups?.map((g) => ({ name: g.key, value: g.value })) ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Report builder</h1>
        <p className="text-sm text-gray-500">Choose a dataset, fields, filters, and chart type — then run, save, or export.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 lg:col-span-1">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Report name</label>
            <input value={def.name} onChange={(e) => setDef({ ...def, name: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Dataset</label>
            <select
              value={def.dataset}
              onChange={(e) => setDef({ ...def, dataset: e.target.value as ReportDefinition['dataset'], fields: [], groupBy: undefined })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring"
            >
              {DATASETS.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Fields</label>
            <div className="flex flex-wrap gap-1.5">
              {fields.map((f) => (
                <button
                  key={f}
                  onClick={() => setDef({ ...def, fields: def.fields.includes(f) ? def.fields.filter((x) => x !== f) : [...def.fields, f] })}
                  className={`rounded-full border px-2.5 py-1 text-xs ${def.fields.includes(f) ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Group by</label>
              <select value={def.groupBy ?? ''} onChange={(e) => setDef({ ...def, groupBy: e.target.value || undefined })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring">
                <option value="">None</option>
                {fields.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Metric</label>
              <select value={def.metric ?? 'count'} onChange={(e) => setDef({ ...def, metric: e.target.value as ReportDefinition['metric'] })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring">
                <option value="count">Count</option>
                <option value="sum">Sum</option>
                <option value="avg">Average</option>
              </select>
            </div>
          </div>
          {(def.metric === 'sum' || def.metric === 'avg') && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Metric field</label>
              <select value={def.metricField ?? ''} onChange={(e) => setDef({ ...def, metricField: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring">
                <option value="">Select field</option>
                {fields.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Chart type</label>
            <div className="flex gap-1.5">
              {(['table', 'bar', 'line', 'pie'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setDef({ ...def, chartType: c })}
                  className={`rounded-full border px-2.5 py-1 text-xs capitalize ${def.chartType === c ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={run} loading={preview.isPending}>
              <Play size={13} /> Run
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                await save.mutateAsync(def);
                toast.show('Report saved', 'success');
              }}
              loading={save.isPending}
            >
              <Save size={13} /> Save
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Preview</h2>
          {!preview.data && <p className="py-16 text-center text-sm text-gray-400">Click "Run" to preview this report.</p>}
          {preview.data && def.chartType === 'bar' && chartData.length > 0 && (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#6366f1" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {preview.data && def.chartType === 'line' && chartData.length > 0 && (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line dataKey="value" stroke="#6366f1" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
          {preview.data && def.chartType === 'pie' && chartData.length > 0 && (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={100}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
          {preview.data && def.chartType === 'table' && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {def.fields.map((f) => (
                      <th key={f} className="px-2 py-1.5 text-left text-xs font-medium text-gray-500">
                        {f}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.data.rows.slice(0, 50).map((row, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      {def.fields.map((f) => (
                        <td key={f} className="px-2 py-1.5 text-gray-700">
                          {String(row[f] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {preview.data && !preview.data.groups && preview.data.rows.length === 0 && <p className="py-10 text-center text-sm text-gray-400">No data matched this report.</p>}
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Saved reports</h2>
        {(reports?.length ?? 0) === 0 ? (
          <p className="text-sm text-gray-400">No saved reports yet.</p>
        ) : (
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {reports!.map((r) => (
              <div key={r._id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{r.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{r.dataset} · {r.chartType}</p>
                </div>
                <div className="flex gap-2">
                  <a href={`/api/reports/${r._id}/export.csv`} target="_blank" rel="noreferrer">
                    <Button variant="secondary" size="sm">
                      <Download size={13} /> CSV
                    </Button>
                  </a>
                  <a href={`/api/reports/${r._id}/export.pdf`} target="_blank" rel="noreferrer">
                    <Button variant="secondary" size="sm">
                      <Download size={13} /> PDF
                    </Button>
                  </a>
                  <Button variant="danger" size="sm" onClick={() => del.mutate(r._id!)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
