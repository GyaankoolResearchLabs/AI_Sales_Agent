import { useState } from 'react';
import { ArrowLeft, UploadCloud, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import Button from '../../components/Button';
import { useImportPreview, useImportCommit, ImportPreview } from '../../api/onboarding';
import { useToast } from '../../stores/ToastContext';

const ENTITIES = [
  { key: 'leads', label: 'Leads' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'companies', label: 'Companies' },
  { key: 'deals', label: 'Deals' },
];

const EXTERNAL_SOURCES = ['Salesforce', 'HubSpot', 'Pipedrive', 'REST API'];

export default function ImportStep({ onBack, onFinish, finishing }: { onBack: () => void; onFinish: () => void; finishing: boolean }) {
  const [entity, setEntity] = useState('leads');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ successCount: number; failedCount: number } | null>(null);
  const toast = useToast();

  const previewMutation = useImportPreview();
  const commitMutation = useImportCommit();

  const onFileChange = async (file: File) => {
    try {
      const data = await previewMutation.mutateAsync({ file, entity });
      setPreview(data);
      const initialMapping: Record<string, string> = {};
      Object.entries(data.mapping).forEach(([header, field]) => {
        if (field) initialMapping[header] = field;
      });
      setMapping(initialMapping);
    } catch {
      toast.show('Could not parse that CSV file', 'error');
    }
  };

  const commit = async () => {
    if (!preview) return;
    try {
      const res = await commitMutation.mutateAsync({ entity, rows: preview.rows, mapping });
      setResult(res);
      toast.show(`Imported ${res.successCount} record(s)`, 'success');
    } catch {
      toast.show('Import failed', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-gray-900">Bring in your existing data</h2>
      <p className="text-sm text-gray-500">Upload a CSV, or skip this and start from scratch — you can always import later from Settings.</p>

      <div className="flex flex-wrap gap-1.5">
        {EXTERNAL_SOURCES.map((s) => (
          <span key={s} className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-400" title="Requires connecting this integration from Settings first">
            {s} (connect later)
          </span>
        ))}
      </div>

      {!preview && (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">What are you importing?</label>
            <div className="flex gap-2">
              {ENTITIES.map((e) => (
                <button
                  key={e.key}
                  onClick={() => setEntity(e.key)}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${
                    entity === e.key ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 py-8 text-center hover:border-brand-400">
            {previewMutation.isPending ? <Loader2 className="animate-spin text-brand-500" size={22} /> : <UploadCloud size={22} className="text-gray-400" />}
            <span className="text-sm font-medium text-gray-600">Click to upload a CSV file</span>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFileChange(e.target.files[0])}
            />
          </label>
        </div>
      )}

      {preview && !result && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Found <strong>{preview.totalRows}</strong> rows. Review the column mapping below, then confirm.
          </p>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">CSV column</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">CRM field</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.headers.map((header) => (
                  <tr key={header}>
                    <td className="px-3 py-2 text-gray-700">{header}</td>
                    <td className="px-3 py-2">
                      <select
                        value={mapping[header] ?? ''}
                        onChange={(e) => setMapping({ ...mapping, [header]: e.target.value })}
                        className="rounded border border-gray-300 px-2 py-1 text-sm"
                      >
                        <option value="">Skip this column</option>
                        <option value="name">Name</option>
                        <option value="email">Email</option>
                        <option value="phone">Phone</option>
                        <option value="companyName">Company</option>
                        <option value="jobTitle">Job title</option>
                        <option value="value">Deal value</option>
                        <option value="stageKey">Stage</option>
                        <option value="status">Status</option>
                        <option value="source">Source</option>
                        <option value="website">Website</option>
                        <option value="industry">Industry</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between pt-1">
            <Button variant="secondary" onClick={() => setPreview(null)}>
              Choose a different file
            </Button>
            <Button onClick={commit} loading={commitMutation.isPending}>
              Import {preview.totalRows} rows
            </Button>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-3 rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 size={16} /> <span className="text-sm font-medium">{result.successCount} imported successfully</span>
          </div>
          {result.failedCount > 0 && (
            <div className="flex items-center gap-2 text-red-600">
              <XCircle size={16} /> <span className="text-sm font-medium">{result.failedCount} failed</span>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between border-t border-gray-100 pt-4">
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft size={14} /> Back
        </Button>
        <Button onClick={onFinish} loading={finishing}>
          {result || preview ? 'Finish setup' : 'Skip — start from scratch'}
        </Button>
      </div>
    </div>
  );
}
