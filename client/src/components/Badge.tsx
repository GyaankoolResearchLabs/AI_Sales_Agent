import { ReactNode } from 'react';
import clsx from 'clsx';

type Tone = 'gray' | 'green' | 'amber' | 'red' | 'blue' | 'purple';

const TONE_CLASSES: Record<Tone, string> = {
  gray: 'bg-gray-100 text-gray-700',
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
};

export default function Badge({ tone = 'gray', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', TONE_CLASSES[tone], className)}>
      {children}
    </span>
  );
}

export function healthTone(health?: string): Tone {
  if (health === 'healthy') return 'green';
  if (health === 'at_risk') return 'amber';
  if (health === 'stalled') return 'red';
  return 'gray';
}

export function priorityTone(priority?: string): Tone {
  if (priority === 'urgent') return 'red';
  if (priority === 'high') return 'amber';
  if (priority === 'medium') return 'blue';
  return 'gray';
}
