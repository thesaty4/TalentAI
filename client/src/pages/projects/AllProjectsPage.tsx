import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState, ErrorBanner, Spinner } from '../../components/Feedback';
import { projectsApi, type Project } from '../../lib/api/projects.api';
import { cn } from '../../lib/utils/cn';

function ProjectRow({ project }: { project: Project }) {
  const navigate = useNavigate();
  const startDate = project.startDate
    ? new Date(project.startDate).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : '-';

  return (
    <div className="flex flex-col gap-2 border-b border-[var(--border-subtle)] px-5 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => navigate(`/projects/${project.id}`)}>
        <p className="truncate font-medium text-network-blue hover:text-celestial-blue">{project.name}</p>
        <p className="text-xs text-[var(--fg-3)]">{project.customer} · starts {startDate}</p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {project.ircs.map(irc => (
            <Badge
              key={irc.id}
              className={cn(
                'text-[10px]',
                irc.status === 'Open' ? 'bg-commerce-green/10 text-commerce-green' : 'bg-level-gray text-secure-gray',
              )}
            >
              {irc.ircCode}
            </Badge>
          ))}
          <span className="text-xs text-[var(--fg-3)]">{project.status}</span>
        </div>
      </div>

      <div className="flex shrink-0 gap-2">
        <Button size="sm" onClick={() => navigate(`/search?projectId=${project.id}`)}>Search candidates</Button>
        <Button size="sm" variant="secondary" onClick={() => navigate(`/pipeline?projectId=${project.id}`)}>
          View pipeline
        </Button>
      </div>
    </div>
  );
}

export function AllProjectsPage() {
  const projectsQ = useQuery({
    queryKey: ['projects', 'all'],
    queryFn: () => projectsApi.list(),
  });

  if (projectsQ.isPending) return <Spinner />;
  if (projectsQ.isError) {
    return <ErrorBanner message="Failed to load projects" onRetry={projectsQ.refetch} />;
  }

  const projects = projectsQ.data ?? [];

  return (
    <Card>
      <h3 className="border-b border-[var(--border-subtle)] px-5 py-3 text-sm font-semibold text-network-blue">
        All projects
      </h3>
      {projects.length === 0
        ? <EmptyState title="No projects found" description="This manager account may not have project ownership yet." />
        : projects.map(project => <ProjectRow key={project.id} project={project} />)}
    </Card>
  );
}
