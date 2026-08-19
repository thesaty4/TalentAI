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

const C = { bg: '#181A24', accent: '#FF5F2D' };

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
        overflow: 'hidden',
      }} className="visible-mobile">
        <SidebarInner nav={nav} collapsed={false} onToggle={onToggle} onClose={onClose} isMobile={true} />
      </aside>

      <style>{`
        @media (min-width: 920px) { .visible-mobile { display: none !important; } }
        @media (max-width: 919px) { .hidden-mobile  { display: none !important; } }

        @keyframes smoke-drift-1 {
          0%,100% { transform: translate(0,0) scale(1); }
          33%     { transform: translate(18px,-28px) scale(1.14); }
          66%     { transform: translate(-14px,-10px) scale(0.91); }
        }
        @keyframes smoke-drift-2 {
          0%,100% { transform: translate(0,0) scale(1); }
          50%     { transform: translate(-24px,-38px) scale(1.2); }
        }
        @keyframes smoke-drift-3 {
          0%,100% { transform: translate(0,0) scale(1); }
          40%     { transform: translate(22px,28px) scale(1.1); }
          75%     { transform: translate(-16px,-18px) scale(0.88); }
        }

        .smoke-blob { position: absolute; border-radius: 50%; pointer-events: none; z-index: 0; }
        .smoke-1 {
          width: 220px; height: 220px; bottom: 30px; left: -60px;
          background: radial-gradient(circle, rgba(255,95,45,0.14) 0%, transparent 70%);
          filter: blur(38px);
          animation: smoke-drift-1 14s ease-in-out infinite;
        }
        .smoke-2 {
          width: 160px; height: 160px; top: 90px; right: -40px;
          background: radial-gradient(circle, rgba(255,95,45,0.10) 0%, transparent 70%);
          filter: blur(32px);
          animation: smoke-drift-2 19s ease-in-out infinite 4s;
        }
        .smoke-3 {
          width: 140px; height: 140px; top: 44%; left: 18%;
          background: radial-gradient(circle, rgba(255,95,45,0.08) 0%, transparent 70%);
          filter: blur(28px);
          animation: smoke-drift-3 24s ease-in-out infinite 9s;
        }
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
      <div className="smoke-blob smoke-1" />
      <div className="smoke-blob smoke-2" />
      <div className="smoke-blob smoke-3" />

      {/* Header */}
      <div style={{
        padding: '14px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed && !isMobile ? 'center' : 'space-between',
        flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        gap: 8,
        position: 'relative', zIndex: 1,
      }}>
        {/* Logo + name — hidden when collapsed on desktop */}
        {(!collapsed || isMobile) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden', flex: 1, minWidth: 0 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, background: C.accent, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 13, color: '#fff',
            }}>T</div>
            <span style={{ color: '#fff', fontWeight: 600, fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              TalentLens AI
            </span>
          </div>
        )}

        {/* Close (mobile) or collapse toggle (desktop) */}
        {isMobile ? (
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#C8CAD3',
          }}><X size={15} /></button>
        ) : (
          <button onClick={onToggle} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#C8CAD3', transition: 'background 150ms',
          }}>
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto', position: 'relative', zIndex: 1 }}>
        {nav.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} style={{ textDecoration: 'none' }}>
            {({ isActive }) => (
              <div style={{
                display: 'flex', alignItems: 'center', gap: collapsed && !isMobile ? 0 : 10,
                padding: collapsed && !isMobile ? '10px 0' : '10px 12px',
                justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
                borderRadius: 9, cursor: 'pointer',
                background: isActive ? 'rgba(255,95,45,0.18)' : 'transparent',
                color: isActive ? '#FF5F2D' : '#858A9B',
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
          position: 'relative', zIndex: 1,
        }}>
          <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em',
            textTransform: 'uppercase', color: C.accent, marginBottom: 4 }}>
            Pro tip
          </p>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 3 }}>
            Try AI Search first
          </p>
          <p style={{ fontSize: 12, color: '#858A9B' }}>
            Describe the role in plain English for instant ranked matches.
          </p>
        </div>
      )}
    </>
  );
}
