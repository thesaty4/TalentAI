import { Bell, ChevronDown, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { Avatar } from '../components/Card';
import { Badge } from '../components/Badge';

interface TopBarProps { title: string; unseenCount?: number; }

export function TopBar({ title, unseenCount = 0 }: TopBarProps) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="flex h-14 items-center justify-between border-b border-[var(--border-subtle)] bg-white px-6">
      <h2 className="text-base font-semibold text-network-blue">{title}</h2>
      <div className="flex items-center gap-4">
        {/* Notification bell */}
        <button className="relative text-secure-gray hover:text-network-blue">
          <Bell size={20} />
          {unseenCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-power-orange text-[10px] font-bold text-white">
              {unseenCount > 9 ? '9+' : unseenCount}
            </span>
          )}
        </button>

        {/* Profile dropdown */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="flex items-center gap-2 text-sm text-secure-gray hover:text-network-blue"
          >
            <Avatar name={user?.name ?? '?'} className="h-7 w-7 text-[11px]" />
            <span className="hidden md:block">{user?.name}</span>
            <Badge className="hidden bg-culture-gray text-secure-gray md:inline-block capitalize">
              {user?.role}
            </Badge>
            <ChevronDown size={14} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-10 z-20 w-40 rounded-lg border border-[var(--border-subtle)] bg-white py-1 shadow-md">
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-power-orange hover:bg-culture-gray"
              >
                <LogOut size={14} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
