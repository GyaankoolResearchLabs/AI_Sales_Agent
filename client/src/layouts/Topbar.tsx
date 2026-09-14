import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, LogOut, Settings as SettingsIcon, ChevronDown } from 'lucide-react';
import { useAuth } from '../stores/AuthContext';
import NotificationBell from './NotificationBell';

export default function Topbar({ onOpenCommandBar }: { onOpenCommandBar: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4">
      <button
        onClick={onOpenCommandBar}
        className="flex flex-1 max-w-md items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-100 focus-ring"
      >
        <Search size={14} />
        <span className="flex-1 text-left">Search or ask AI…</span>
        <kbd className="hidden sm:inline rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[11px] text-gray-400">Ctrl K</kbd>
      </button>

      <div className="flex-1" />

      <NotificationBell />

      <div className="relative" ref={ref}>
        <button onClick={() => setMenuOpen((v) => !v)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100 focus-ring">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: user?.avatarColor || '#6366f1' }}
          >
            {user?.name?.slice(0, 1).toUpperCase()}
          </span>
          <span className="hidden sm:block text-sm font-medium text-gray-700">{user?.name}</span>
          <ChevronDown size={14} className="hidden sm:block text-gray-400" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-11 z-40 w-52 rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
            <div className="border-b border-gray-100 px-3 py-2">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
            <button
              onClick={() => {
                navigate('/settings');
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <SettingsIcon size={14} /> Settings
            </button>
            <button onClick={() => logout()} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
              <LogOut size={14} /> Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
