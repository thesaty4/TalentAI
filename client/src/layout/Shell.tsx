import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

const TITLES: Record<string, string> = {
  '/dashboard':   'Dashboard',
  '/search':      'AI Search',
  '/pipeline':    'Pipeline',
  '/pool':        'Resource Pool',
  '/irc-applied': 'IRC Applied',
  '/projects':    'All Projects',
  '/open-ircs':   'Open IRCs',
  '/my-pipeline': 'My Pipeline',
  '/feedback':    'My Feedback',
  '/upcoming':    'Upcoming',
};

export function Shell() {
  const { pathname } = useLocation();
  const [collapsed,   setCollapsed]   = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const title = TITLES[pathname] ?? 'TalentLens AI';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F5F6F8' }}>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 40,
          background: 'rgba(0,38,58,0.45)', backdropFilter: 'blur(2px)',
        }} onClick={() => setMobileOpen(false)} />
      )}

      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggle={() => setCollapsed(c => !c)}
        onClose={() => setMobileOpen(false)}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <TopBar title={title} onMenuClick={() => setMobileOpen(true)} />
        <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
