import { NavLink } from 'react-router-dom';
import { Sparkles, MessageSquare, Handshake, Kanban, ListChecks } from 'lucide-react';
import clsx from 'clsx';

const ITEMS = [
  { label: 'Briefing', to: '/', icon: Sparkles },
  { label: 'Assistant', to: '/assistant', icon: MessageSquare },
  { label: 'Deals', to: '/deals', icon: Handshake },
  { label: 'Pipeline', to: '/pipeline', icon: Kanban },
  { label: 'Tasks', to: '/tasks', icon: ListChecks },
];

export default function MobileNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex md:hidden border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)]">
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            clsx(
              'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium focus-ring',
              isActive ? 'text-brand-600' : 'text-gray-500'
            )
          }
        >
          <item.icon size={19} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
