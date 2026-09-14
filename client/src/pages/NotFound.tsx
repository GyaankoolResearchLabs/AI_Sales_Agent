import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <h1 className="text-3xl font-semibold text-gray-900">404</h1>
      <p className="mt-1 text-sm text-gray-500">This page doesn't exist.</p>
      <Button className="mt-4" onClick={() => navigate('/')}>
        Back to Daily Briefing
      </Button>
    </div>
  );
}
