import { Mail, Phone, Calendar, MessageCircle, FileText, CheckSquare } from 'lucide-react';
import { Activity } from '../types';
import EmptyState from './EmptyState';

const ICONS: Record<string, typeof Mail> = {
  email: Mail,
  call: Phone,
  meeting: Calendar,
  whatsapp: MessageCircle,
  note: FileText,
  task: CheckSquare,
};

export default function ActivityTimeline({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) return <EmptyState title="No activity yet" description="Emails, calls, and meetings will show up here." />;

  return (
    <div className="space-y-0">
      {activities.map((a, i) => {
        const Icon = ICONS[a.type] ?? FileText;
        return (
          <div key={a._id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                <Icon size={13} />
              </div>
              {i < activities.length - 1 && <div className="w-px flex-1 bg-gray-200" />}
            </div>
            <div className="flex-1 pb-4">
              <p className="text-sm font-medium text-gray-900">{a.subject}</p>
              {a.body && <p className="mt-0.5 text-sm text-gray-500">{a.body}</p>}
              <p className="mt-0.5 text-xs text-gray-400">
                {a.owner?.name ? `${a.owner.name} · ` : ''}
                {new Date(a.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
