import { AlertTriangle, RotateCw } from 'lucide-react';
import Button from './Button';

export default function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-red-100 bg-red-50/50 py-14 px-6 text-center">
      <AlertTriangle className="mb-3 text-red-500" size={22} />
      <h3 className="text-sm font-semibold text-gray-900">Something went wrong</h3>
      <p className="mt-1 max-w-sm text-sm text-gray-500">{message || 'Please try again in a moment.'}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          <RotateCw size={14} /> Retry
        </Button>
      )}
    </div>
  );
}
