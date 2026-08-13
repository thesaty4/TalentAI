import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState, ErrorBanner, Spinner } from '../../components/Feedback';
import { cn } from '../../lib/utils/cn';
import { projectsApi } from '../../lib/api/projects.api';

export function ProjectDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const query = useQuery({
    queryKey: ['project', id],
    queryFn:  () => projectsApi.getOne(Number(id)),
    enabled:  !!id,
  });

  if (query.isPending) return <Spinner />;
  if (query.isError)   return <ErrorBanner message="Failed to load project" onRetry={query.refetch} />;
  if (!query.data)     return <EmptyState title="Project not found" />;

  const project = query.data;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="flex items-center gap-1.5">
          <ArrowLeft size={14} /> Back
        </Button>
        <div>
          <h1 className="text-lg font-bold text-network-blue">{project.name}</h1>
          <p className="text-sm text-[var(--fg-3)]">{project.customer}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button size="sm" onClick={() => navigate(`/search?projectId=${project.id}`)}>Search candidates</Button>
        <Button size="sm" variant="secondary" onClick={() => navigate(`/pipeline?projectId=${project.id}`)}>View pipeline</Button>
      </div>

      <h2 className="text-sm font-semibold text-secure-gray">Requisitions ({project.ircs.length})</h2>
      {project.ircs.length === 0 && <EmptyState title="No IRCs for this project" />}
      <div className="grid gap-3 sm:grid-cols-2">
        {project.ircs.map(irc => (
          <Card key={irc.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-celestial-blue">{irc.ircCode}</p>
                <p className="mt-0.5 font-medium text-network-blue">{irc.roleTitle}</p>
              </div>
              <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium',
                irc.status === 'Open' ? 'bg-commerce-green/10 text-commerce-green' : 'bg-level-gray text-secure-gray')}>
                {irc.status}
              </span>
            </div>
            {irc.status === 'Open' && (
              <Button size="sm" className="mt-3" onClick={() => navigate(`/search?projectId=${project.id}&ircId=${irc.id}`)}>
                Search candidates
              </Button>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
