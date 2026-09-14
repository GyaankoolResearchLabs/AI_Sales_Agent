import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Handshake, Users, ListChecks, Kanban, MessageSquare, CornerDownLeft } from 'lucide-react';
import { useGlobalSearch } from '../api/misc';

interface CommandBarProps {
  open: boolean;
  onClose: () => void;
}

const QUICK_ACTIONS = [
  { label: 'Ask AI', to: '/assistant', icon: MessageSquare },
  { label: 'Open Pipeline', to: '/pipeline', icon: Kanban },
  { label: 'View Deals', to: '/deals', icon: Handshake },
  { label: 'View Leads', to: '/leads', icon: Users },
  { label: 'View Tasks', to: '/tasks', icon: ListChecks },
];

export default function CommandBar({ open, onClose }: CommandBarProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { data } = useGlobalSearch(query);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  if (!open) return null;

  const go = (to: string) => {
    navigate(to);
    onClose();
  };

  const groups: { label: string; items: { id: string; label: string; sublabel?: string; to: string }[] }[] = data
    ? [
        { label: 'Deals', items: data.deals.map((d) => ({ id: d.id, label: d.label, sublabel: d.sublabel, to: `/deals/${d.id}` })) },
        { label: 'Leads', items: data.leads.map((d) => ({ id: d.id, label: d.label, sublabel: d.sublabel, to: `/leads/${d.id}` })) },
        { label: 'Contacts', items: data.contacts.map((d) => ({ id: d.id, label: d.label, sublabel: d.sublabel, to: `/contacts` })) },
        { label: 'Companies', items: data.companies.map((d) => ({ id: d.id, label: d.label, sublabel: d.sublabel, to: `/companies` })) },
      ].filter((g) => g.items.length > 0)
    : [];

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 pt-[12vh] px-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center gap-2 border-b border-gray-100 px-3.5 py-3">
          <Search size={16} className="text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search CRM, ask AI, or jump to a page…"
            className="flex-1 text-sm outline-none placeholder:text-gray-400"
          />
          <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[11px] text-gray-400">Esc</kbd>
        </div>

        <div className="max-h-96 overflow-y-auto py-2">
          {query.trim().length <= 1 && (
            <div className="px-2">
              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Quick actions</p>
              {QUICK_ACTIONS.map((a) => (
                <button
                  key={a.to}
                  onClick={() => go(a.to)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 focus-ring"
                >
                  <a.icon size={16} className="text-gray-400" />
                  {a.label}
                </button>
              ))}
            </div>
          )}

          {query.trim().length > 1 && groups.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-gray-400">No matches for "{query}"</p>
          )}

          {groups.map((g) => (
            <div key={g.label} className="px-2">
              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{g.label}</p>
              {g.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => go(item.to)}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 focus-ring"
                >
                  <span className="truncate">
                    {item.label}
                    {item.sublabel && <span className="ml-1.5 text-gray-400">{item.sublabel}</span>}
                  </span>
                  <CornerDownLeft size={13} className="text-gray-300" />
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
