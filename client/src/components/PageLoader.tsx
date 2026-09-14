import { Loader2 } from 'lucide-react';

export default function PageLoader() {
  return (
    <div className="flex h-full min-h-[200px] w-full items-center justify-center py-24">
      <Loader2 className="animate-spin text-brand-500" size={28} />
    </div>
  );
}
