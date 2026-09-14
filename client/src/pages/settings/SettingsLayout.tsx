import { NavLink, Outlet } from 'react-router-dom';
import clsx from 'clsx';

const TABS = [
  { to: 'organization', label: 'Organization' },
  { to: 'sales-process', label: 'Sales Process' },
  { to: 'autonomy', label: 'AI & Autonomy' },
  { to: 'integrations', label: 'Integrations' },
  { to: 'security', label: 'Security' },
];

export default function SettingsLayout() {
  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              clsx(
                'whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium',
                isActive ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              )
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
