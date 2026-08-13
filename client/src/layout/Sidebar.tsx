import { NavLink } from 'react-router-dom';
import { cn } from '../lib/utils/cn';
import { useAuth } from '../auth/useAuth';

const MANAGER_HR_NAV = [
  { to: '/dashboard',   label: 'Dashboard' },
  { to: '/search',      label: 'AI Search' },
  { to: '/pipeline',    label: 'Pipeline' },
  { to: '/pool',        label: 'Resource Pool' },
  { to: '/irc-applied', label: 'IRC Applied' },
];

const CANDIDATE_NAV = [
  { to: '/dashboard',   label: 'Dashboard' },
  { to: '/open-ircs',   label: 'Open IRCs' },
  { to: '/my-pipeline', label: 'My Pipeline' },
  { to: '/feedback',    label: 'Feedback' },
  { to: '/upcoming',    label: 'Upcoming' },
];

export function Sidebar() {
  const { user } = useAuth();
  const nav = user?.role === 'candidate' ? CANDIDATE_NAV : MANAGER_HR_NAV;

  return (
    <aside className="flex h-full w-56 flex-col bg-network-blue">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-power-orange text-sm font-bold text-white">
          T
        </span>
        <span className="font-display text-sm font-semibold text-white">TalentLens</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-2 py-2">
        {nav.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'border-l-2 border-power-orange bg-white/10 text-white'
                  : 'text-[var(--fg-on-dark-2)] hover:bg-white/10 hover:text-white',
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
