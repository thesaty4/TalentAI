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
  const title = TITLES[pathname] ?? 'TalentLens AI';

  return (
    <div className="flex h-screen overflow-hidden bg-culture-gray">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title={title} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
