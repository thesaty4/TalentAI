import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, Menu, LogOut } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/client';
import { useAuth } from '../auth/useAuth';

interface Props { title: string; onMenuClick: () => void; }

const C = { accent: '#3B6E64', fg1: '#1B2430', fg3: '#8891A0', border: '#E3E5E9' };

function initials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

// Stable callback via ref — avoids re-adding listener on every render
function useClickOutside(ref: React.RefObject<HTMLElement>, cb: () => void) {
  const cbRef = useRef(cb);
  cbRef.current = cb;
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) cbRef.current(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

const DROPDOWN_STYLE: React.CSSProperties = {
  position: 'absolute', top: '100%', right: 0, marginTop: 8,
  width: 320, background: '#fff', border: `1px solid ${C.border}`,
  borderRadius: 12, boxShadow: '0 14px 32px rgba(0,38,58,0.10), 0 4px 8px rgba(0,38,58,0.06)',
  zIndex: 50, padding: 8,
};

export function TopBar({ title, onMenuClick }: Props) {
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const [bellOpen,    setBellOpen]    = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const bellRef    = useRef<HTMLDivElement>(null!);
  const profileRef = useRef<HTMLDivElement>(null!);

  useClickOutside(bellRef,    () => setBellOpen(false));
  useClickOutside(profileRef, () => { setProfileOpen(false); setConfirmLogout(false); });

  const notifQ = useQuery({
    queryKey: ['notifications-bar'],
    queryFn:  () => apiClient.get('/notifications').then(r => r.data),
    staleTime: 30_000,
  });

  const markSeenMut = useMutation({
    mutationFn: () => apiClient.patch('/notifications/mark-seen'),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['notifications-bar'] }),
  });

  const notifications: any[] = notifQ.data?.data ?? [];
  const unseenCount = notifQ.data?.meta?.unseenCount ?? 0;

  function handleBellClick() {
    setBellOpen(o => !o);
    if (!bellOpen && unseenCount > 0) markSeenMut.mutate();
  }

  return (
    <header style={{
      height: 64, background: '#fff', borderBottom: `1px solid ${C.border}`,
      padding: '0 24px', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0,
    }}>
      {/* Mobile hamburger */}
      <button onClick={onMenuClick} style={{
        display: 'none', width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.border}`,
        background: '#fff', cursor: 'pointer', alignItems: 'center', justifyContent: 'center',
      }} className="hamburger">
        <Menu size={18} color={C.fg1} />
      </button>

      {/* Page title */}
      <h1 style={{
        flex: 1, margin: 0, fontSize: 18, fontWeight: 600, color: C.fg1,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{title}</h1>

      {/* Notification bell */}
      <div ref={bellRef} style={{ position: 'relative' }}>
        <button onClick={handleBellClick} style={{
          width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.border}`,
          background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          <Bell size={17} color={C.fg1} strokeWidth={1.75} />
          {unseenCount > 0 && (
            <span style={{
              position: 'absolute', top: 5, right: 5, width: 8, height: 8,
              borderRadius: '50%', background: C.accent,
              border: '1.5px solid #fff',
            }} />
          )}
        </button>
        {bellOpen && (
          <div style={DROPDOWN_STYLE}>
            <p style={{ fontSize: 12, fontWeight: 700, color: C.fg3, padding: '4px 8px 8px',
              textTransform: 'uppercase', letterSpacing: '0.04em' }}>Notifications</p>
            {notifications.length === 0 && (
              <p style={{ fontSize: 13, color: C.fg3, padding: '8px 8px 4px' }}>No notifications</p>
            )}
            {notifications.map((n: any, i: number) => (
              <div key={n.id} style={{
                padding: '9px 8px', borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.fg1 }}>{n.title}</span>
                  <span style={{ fontSize: 11, color: C.fg3, flexShrink: 0 }}>
                    {new Date(n.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {n.description && (
                  <p style={{ fontSize: 12.5, color: C.fg3, marginTop: 2 }}>{n.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Profile menu */}
      <div ref={profileRef} style={{ position: 'relative' }}>
        <button onClick={() => { setProfileOpen(o => !o); setConfirmLogout(false); }} style={{
          display: 'flex', alignItems: 'center', gap: 8, background: 'none',
          border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 8,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', background: '#003057',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>{initials(user?.name ?? '?')}</div>
          <ChevronDown size={13} color={C.fg3} />
        </button>
        {profileOpen && (
          <div style={{ ...DROPDOWN_STYLE, width: 230 }}>
            <div style={{ padding: '8px 12px 12px' }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: C.fg1 }}>{user?.name}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span style={{
                  background: '#F5F6F8', color: '#8891A0', fontSize: 10.5, fontWeight: 700,
                  letterSpacing: '0.04em', textTransform: 'uppercase', borderRadius: 999,
                  padding: '3px 8px',
                }}>{user?.role}</span>
              </div>
            </div>
            <div style={{ borderTop: `1px solid ${C.border}`, padding: '8px 4px 4px' }}>
              {!confirmLogout ? (
                <button onClick={() => setConfirmLogout(true)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 8px', border: 'none', background: 'none',
                  cursor: 'pointer', color: C.accent, fontSize: 13, fontWeight: 500, borderRadius: 7,
                }}>
                  <LogOut size={15} /> Log out
                </button>
              ) : (
                <div style={{ padding: '4px 8px' }}>
                  <p style={{ fontSize: 12, color: C.fg3, marginBottom: 8 }}>Are you sure?</p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setConfirmLogout(false)} style={{
                      flex: 1, padding: '7px', border: `1px solid ${C.border}`, background: '#fff',
                      borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: C.fg1,
                    }}>Cancel</button>
                    <button onClick={logout} style={{
                      flex: 1, padding: '7px', border: 'none', background: C.accent,
                      borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#fff',
                    }}>Confirm</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 919px) { .hamburger { display: flex !important; } }
      `}</style>
    </header>
  );
}
