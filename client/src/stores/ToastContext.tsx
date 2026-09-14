import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import clsx from 'clsx';

interface Toast {
  id: number;
  message: string;
  variant: 'success' | 'error' | 'info';
}

interface ToastState {
  show: (message: string, variant?: Toast['variant']) => void;
}

const ToastContext = createContext<ToastState | undefined>(undefined);

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, variant: Toast['variant'] = 'info') => {
    const id = ++counter;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-[calc(100vw-2rem)]">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={clsx(
              'flex items-start gap-2 rounded-lg border px-3.5 py-2.5 shadow-lg text-sm bg-white min-w-[240px] max-w-sm animate-[fadeIn_.15s_ease-out]',
              t.variant === 'success' && 'border-emerald-200',
              t.variant === 'error' && 'border-red-200',
              t.variant === 'info' && 'border-gray-200'
            )}
          >
            {t.variant === 'success' && <CheckCircle2 size={18} className="text-emerald-500 mt-0.5 shrink-0" />}
            {t.variant === 'error' && <XCircle size={18} className="text-red-500 mt-0.5 shrink-0" />}
            {t.variant === 'info' && <Info size={18} className="text-brand-500 mt-0.5 shrink-0" />}
            <span className="flex-1 text-gray-700">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="text-gray-400 hover:text-gray-600 focus-ring rounded">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
