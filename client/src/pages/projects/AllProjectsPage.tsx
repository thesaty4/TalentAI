import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState, ErrorBanner, Spinner } from '../../components/Feedback';
import { useAuth } from '../../auth/useAuth';
import { projectsApi, type Project } from '../../lib/api/projects.api';
import { cn } from '../../lib/utils/cn';

const STATUS_FILTERS = ['All', 'Active', 'Completed'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

function ProjectCard({ project }: { project: Project }) {
  const navigate  = useNavigate();
  const startDate = project.startDate
    ? new Date(project.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
  const openCount = project.ircs.filter(i => i.status === 'Open').length;

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <button
          className="min-w-0 flex-1 text-left"
          onClick={() => navigate(`/projects/${project.id}`)}
        >
          <p className="truncate font-semibold text-network-blue hover:text-celestial-blue">
            {project.name}
          </p>
          <p className="text-sm text-[var(--fg-3)]">{project.customer}</p>
          <p className="mt-0.5 text-xs text-[var(--fg-3)]">Starts {startDate}</p>
        </button>
        <span className={cn(
          'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium',
          project.status === 'Active'
            ? 'bg-commerce-green/10 text-commerce-green'
            : 'bg-level-gray text-secure-gray',
        )}>
          {project.status}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {project.ircs.length === 0 && (
          <span className="text-xs text-[var(--fg-3)]">No requisitions</span>
        )}
        {project.ircs.map(irc => (
          <Badge key={irc.id} className={cn(
            'text-[10px]',
            irc.status === 'Open'
              ? 'bg-celestial-blue/10 text-celestial-blue'
              : 'bg-level-gray text-secure-gray',
          )}>
            {irc.ircCode} · {irc.status}
          </Badge>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {openCount > 0 && (
          <Button size="sm" onClick={() => navigate(`/search?projectId=${project.id}`)}>
            Search candidates
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => navigate(`/pipeline?projectId=${project.id}`)}>
          View pipeline
        </Button>
        <Button size="sm" variant="ghost" onClick={() => navigate(`/projects/${project.id}`)}>
          Details
        </Button>
      </div>
    </Card>
  );
}

export function AllProjectsPage() {
  const { user }                                = useAuth();
  const navigate                                = useNavigate();
  const [searchText,    setSearchText]          = useState('');
  const [statusFilter,  setStatusFilter]        = useState<StatusFilter>('All');

  const projectsQ = useQuery({
    queryKey: ['projects'],
    queryFn:  () => projectsApi.list(),
  });

  if (projectsQ.isPending) return <Spinner />;
  if (projectsQ.isError)   return <ErrorBanner message="Failed to load projects" onRetry={projectsQ.refetch} />;

  const q       = searchText.trim().toLowerCase();
  const visible = (projectsQ.data ?? []).filter(p => {
    const matchStatus = statusFilter === 'All' || p.status === statusFilter;
    const matchSearch = !q || p.name.toLowerCase().includes(q) || p.customer.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-bold text-network-blue">
          {user?.role === 'hr' ? 'All Projects' : 'My Projects'}
        </h1>
        <Button size="sm" onClick={() => navigate('/search')}>AI Search</Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-xs flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-3)]" />
          <input
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Search projects…"
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-white py-1.5 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-celestial-blue/30"
          />
        </div>
        <div className="flex gap-1.5">
          {STATUS_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                statusFilter === f
                  ? 'bg-network-blue text-white'
                  : 'border border-[var(--border-subtle)] bg-white text-secure-gray hover:bg-level-gray',
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <EmptyState
          title="No projects found"
          description={q || statusFilter !== 'All' ? 'Try adjusting your filters.' : 'No projects assigned yet.'}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map(p => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}
    </div>
  );
}
