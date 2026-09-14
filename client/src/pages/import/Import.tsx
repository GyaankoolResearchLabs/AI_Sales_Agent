import { useNavigate } from 'react-router-dom';
import ImportStep from '../onboarding/ImportStep';

export default function Import() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Import data</h1>
        <p className="text-sm text-gray-500">Bring in leads, contacts, companies, or deals from a CSV file.</p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <ImportStep onBack={() => navigate(-1)} onFinish={() => navigate('/leads')} finishing={false} />
      </div>
    </div>
  );
}
