import { ReactNode } from 'react';
import clsx from 'clsx';

interface MetricCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  trend?: { direction: 'up' | 'down'; label: string } | null;
  className?: string;
}

export default function MetricCard({ label, value, hint, icon, trend, className }: MetricCardProps) {
  return (
    <div className={clsx('rounded-xl border border-gray-200 bg-white p-4', className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
        {icon && <span className="text-gray-400">{icon}</span>}
      </div>
      <div className="mt-1.5 text-2xl font-semibold text-gray-900">{value}</div>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      {trend && (
        <p className={clsx('mt-1 text-xs font-medium', trend.direction === 'up' ? 'text-emerald-600' : 'text-red-600')}>{trend.label}</p>
      )}
    </div>
  );
}
