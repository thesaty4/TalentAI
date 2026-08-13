import { NavLink } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X,
         LayoutDashboard, Search, Columns, Users, FileText,
         Target, Activity, MessageSquare, Calendar } from 'lucide-react';
import { useAuth } from '../auth/useAuth';

interface Props {
  collapsed:  boolean;
  mobileOpen: boolean;
  onToggle:   () => void;
  onClose:    () => void;
}

const C = { bg: '#1B2430', accent: '#3B6E64' };

const MANAGER_NAV = [
  { to: '/dashboard',   label: 'Dashboard',     Icon: LayoutDashboard },
  { to: '/search',      label: 'AI Search',      Icon: Search },
  { to: '/pipeline',    label: 'Pipeline',       Icon: Columns },
  { to: '/pool',        label: 'Resource Pool',  Icon: Users },
  { to: '/irc-applied', label: 'IRC Applied',    Icon: FileText },
];
const CANDIDATE_NAV = [
  { to: '/dashboard',   label: 'Dashboard',   Icon: LayoutDashboard },
  { to: '/open-ircs',   label: 'Open IRCs',   Icon: Target },
  { to: '/my-pipeline', label: 'My Pipeline', Icon: Activity },
  { to: '/feedback',    label: 'Feedback',    Icon: MessageSquare },
  { to: '/upcoming',    label: 'Upcoming',    Icon: Calendar },
];

export function Sidebar({ collapsed, mobileOpen, onToggle, onClose }: Props) {
  const { user } = useAuth();
  const nav = user?.role === 'candidate' ? CANDIDATE_NAV : MANAGER_NAV;

  const W = collapsed ? 68 : 246;

  // On mobile: fixed off-canvas drawer; on desktop: static column
  const mobileStyle: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, height: '100%', zIndex: 50,
    transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform 220ms ease',
  };
  const desktopStyle: React.CSSProperties = {
    width: W, transition: 'width 200ms ease', flexShrink: 0,
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside style={{
        ...desktopStyle,
        background: C.bg,
        display: 'flex', flexDirection: 'column',
        position: 'relative', overflow: 'hidden',
      }} className="hidden-mobile">
        <SidebarInner nav={nav} collapsed={collapsed} onToggle={onToggle} onClose={onClose} isMobile={false} />
      </aside>

      {/* Mobile off-canvas drawer */}
      <aside style={{
        ...mobileStyle,
        width: 250, background: C.bg,
        display: 'flex', flexDirection: 'column',
      }} className="visible-mobile">
        <SidebarInner nav={nav} collapsed={false} onToggle={onToggle} onClose={onClose} isMobile={true} />
      </aside>

      <style>{`
        @media (min-width: 920px) { .visible-mobile { display: none !important; } }
        @media (max-width: 919px) { .hidden-mobile  { display: none !important; } }
      `}</style>
    </>
  );
}

function SidebarInner({ nav, collapsed, onToggle, onClose, isMobile }: {
  nav: typeof MANAGER_NAV; collapsed: boolean;
  onToggle: () => void; onClose: () => void; isMobile: boolean;
}) {
  return (
    <>
      {/* Header */}
      <div style={{
        padding: '18px 16px', display: 'flex', alignItems: 'center',
        justifyContent: collapsed && !isMobile ? 'center' : 'space-between',
        position: 'relative', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7, background: C.accent, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 13, color: '#fff',
          }}>T</div>
          {(!collapsed || isMobile) && (
            <span style={{ color: '#fff', fontWeight: 600, fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden' }}>
              TalentLens AI
            </span>
          )}
        </div>
        {/* Close (mobile) or toggle (desktop) */}
        {isMobile ? (
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#B7C1C8', padding: 4,
          }}><X size={18} /></button>
        ) : (
          <button onClick={onToggle} style={{
            position: 'absolute', right: -12, top: 22,
            width: 24, height: 24, borderRadius: '50%',
            background: '#fff', border: '1px solid #E3E5E9',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 10, flexShrink: 0,
          }}>
            {collapsed ? <ChevronRight size={12} color="#333D4A" /> : <ChevronLeft size={12} color="#333D4A" />}
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
        {nav.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} style={{ textDecoration: 'none' }}>
            {({ isActive }) => (
              <div style={{
                display: 'flex', alignItems: 'center', gap: collapsed && !isMobile ? 0 : 10,
                padding: collapsed && !isMobile ? '10px 0' : '10px 12px',
                justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
                borderRadius: 9, cursor: 'pointer',
                background: isActive ? 'rgba(59,110,100,0.35)' : 'transparent',
                color: isActive ? '#CFE9E1' : '#B7C1C8',
                transition: 'background 150ms',
              }}>
                <Icon size={19} strokeWidth={1.75} style={{ flexShrink: 0 }} />
                {(!collapsed || isMobile) && (
                  <span style={{
                    fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>{label}</span>
                )}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom promo card (expanded only) */}
      {(!collapsed || isMobile) && (
        <div style={{
          margin: '0 16px 16px',
          padding: 14,
          borderRadius: 12,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.10)',
          flexShrink: 0,
        }}>
          <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em',
            textTransform: 'uppercase', color: C.accent, marginBottom: 4 }}>
            Pro tip
          </p>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 3 }}>
            Try AI Search first
          </p>
          <p style={{ fontSize: 12, color: '#B7C1C8' }}>
            Describe the role in plain English for instant ranked matches.
          </p>
        </div>
      )}
    </>
  );
}
