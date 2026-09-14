import { NavLink } from 'react-router-dom';
import { ChevronsLeft, ChevronsRight, Bot } from 'lucide-react';
import clsx from 'clsx';
import { NAV_SECTIONS } from './navConfig';
import { useAuth } from '../stores/AuthContext';

export default function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { user } = useAuth();
  const isManager = user && ['sales_manager', 'sales_director', 'admin'].includes(user.role);

  return (
    <aside
      className={clsx(
        'hidden md:flex md:flex-col border-r border-gray-200 bg-white transition-[width] duration-150 shrink-0',
        collapsed ? 'w-[68px]' : 'w-60'
      )}
    >
      <div className={clsx('flex items-center gap-2 border-b border-gray-100 px-4 h-14', collapsed && 'justify-center px-0')}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
          <Bot size={17} />
        </div>
        {!collapsed && <span className="text-sm font-semibold text-gray-900 truncate">Northwind AI</span>}
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-none px-2 py-3 space-y-4">
        {NAV_SECTIONS.map((section) => {
          const items = section.items.filter((item) => !item.managerOnly || isManager);
          if (items.length === 0) return null;
          return (
            <div key={section.title || 'root'}>
              {section.title && !collapsed && (
                <p className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{section.title}</p>
              )}
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      clsx(
                        'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors focus-ring',
                        collapsed && 'justify-center px-0',
                        isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      )
                    }
                  >
                    <item.icon size={17} className="shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <button
        onClick={onToggle}
        className="flex items-center justify-center gap-2 border-t border-gray-100 py-3 text-gray-400 hover:bg-gray-50 hover:text-gray-600 focus-ring"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
      </button>
    </aside>
  );
}
