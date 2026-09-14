import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications, useMarkAllNotificationsRead, useMarkNotificationRead } from '../api/misc';
import { Skeleton } from '../components/Skeleton';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { data, isLoading } = useNotifications();
  const markAll = useMarkAllNotificationsRead();
  const markOne = useMarkNotificationRead();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const unread = data?.unreadCount ?? 0;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus-ring"
        aria-label="Notifications"
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-40 w-80 max-h-[70vh] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-3.5 py-2.5">
            <span className="text-sm font-semibold text-gray-900">Notifications</span>
            {unread > 0 && (
              <button onClick={() => markAll.mutate()} className="text-xs font-medium text-brand-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          {isLoading && (
            <div className="space-y-2 p-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}
          {!isLoading && (data?.items.length ?? 0) === 0 && <p className="px-4 py-8 text-center text-sm text-gray-400">You're all caught up.</p>}
          {data?.items.map((n) => (
            <button
              key={n._id}
              onClick={() => {
                markOne.mutate(n._id);
                if (n.link) navigate(n.link);
                setOpen(false);
              }}
              className={`flex w-full flex-col items-start gap-0.5 border-b border-gray-50 px-3.5 py-2.5 text-left hover:bg-gray-50 ${!n.isRead ? 'bg-brand-50/40' : ''}`}
            >
              <span className="text-sm font-medium text-gray-900">{n.title}</span>
              <span className="text-xs text-gray-500">{n.message}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
