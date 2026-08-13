import { useQuery } from '@tanstack/react-query';
import { Card, KpiCard } from '../../components/Card';
import { EmptyState, ErrorBanner, Spinner } from '../../components/Feedback';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { cn } from '../../lib/utils/cn';
import { poolApi } from '../../lib/api/pool.api';
import { useAuth } from '../../auth/useAuth';
import { useDashboard } from './useDashboard';
import { PIPELINE_STAGES, STAGE_COLORS } from '../../lib/constants/pipeline.constants';
import type { Project } from '../../lib/api/projects.api';

function HiringFunnel({ funnel }: { funnel: Record<string, number> }) {
  const max = Math.max(...Object.values(funnel), 1);
  return (
    <Card className="p-5">
      <h3 className="mb-4 text-sm font-semibold text-network-blue">Hiring funnel</h3>
      <div className="space-y-3">
        {PIPELINE_STAGES.map(stage => {
          const count = funnel[stage] ?? 0;
          const bgCls = STAGE_COLORS[stage]?.split(' ')[0] ?? 'bg-level-gray';
          return (
            <div key={stage} className="flex items-center gap-3">
              <span className="w-36 truncate text-xs text-secure-gray">{stage}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-level-gray">
                <div className={cn('h-2 rounded-full transition-all', bgCls)} style={{ width: `${(count / max) * 100}%` }} />
              </div>
              <span className="w-5 text-right text-xs font-medium text-secure-gray">{count}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ProjectRow({ project, pipelineCount }: { project: Project; pipelineCount: number }) {
  const navigate  = useNavigate();
  const startDate = project.startDate ? new Date(project.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
  return (
    <div className="flex flex-col gap-2 border-b border-[var(--border-subtle)] px-5 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-network-blue">{project.name}</p>
        <p className="text-xs text-[var(--fg-3)]">{project.customer} · starts {startDate}</p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {project.ircs.map(irc => (
            <Badge key={irc.id} className={cn('text-[10px]', irc.status === 'Open' ? 'bg-commerce-green/10 text-commerce-green' : 'bg-level-gray text-secure-gray')}>
              {irc.ircCode}
            </Badge>
          ))}
          <span className="text-xs text-[var(--fg-3)]">{pipelineCount} in pipeline</span>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" onClick={() => navigate(`/search?projectId=${project.id}`)}>Search candidates</Button>
        <Button size="sm" variant="secondary" onClick={() => navigate(`/pipeline?projectId=${project.id}`)}>View pipeline</Button>
      </div>
    </div>
  );
}

export function HRDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { projectsQ, pipelineQ, projects, kpis, funnel, pipelinePerProject } = useDashboard();

  const benchQ = useQuery({ queryKey: ['pool', 'bench'],     queryFn: () => poolApi.count('Bench') });
  const allocQ = useQuery({ queryKey: ['pool', 'allocated'], queryFn: () => poolApi.count('Allocated') });

  if (projectsQ.isPending || pipelineQ.isPending) return <Spinner />;
  if (projectsQ.isError) return <ErrorBanner message="Failed to load projects" onRetry={projectsQ.refetch} />;

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <div className="space-y-6">
      <p className="text-sm text-secure-gray">
        Good morning, <span className="font-medium text-network-blue">{firstName}</span>.{' '}
        Here's the org-wide picture.
      </p>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Open Requisitions"  value={kpis.openIrcs} />
        <KpiCard label="Active Pipeline"    value={kpis.activePipeline} />
        <KpiCard label="Awaiting Review"    value={kpis.awaitingReview} sub="AI Shortlisted" />
        <KpiCard label="Positions Filled"   value={kpis.filled} />
      </div>

      {/* Pool utilization */}
      <div className="grid grid-cols-2 gap-4">
        <KpiCard label="On Bench"  value={benchQ.data ?? '—'} sub="Available now" />
        <KpiCard label="Allocated" value={allocQ.data ?? '—'} sub="Currently staffed" />
      </div>

      {/* Hiring funnel + projects */}
      <div className="grid gap-6 lg:grid-cols-2">
        <HiringFunnel funnel={funnel} />
        <Card>
          <h3 className="border-b border-[var(--border-subtle)] px-5 py-3 text-sm font-semibold text-network-blue flex items-center justify-between">
            All projects
            <Button variant="ghost" size="sm" onClick={() => navigate('/projects')} className="text-xs text-celestial-blue">View all</Button>
          </h3>
          {projects.length === 0
            ? <EmptyState title="No projects found" />
            : projects.map(p => <ProjectRow key={p.id} project={p} pipelineCount={pipelinePerProject.get(p.id) ?? 0} />)}
        </Card>
      </div>
    </div>
  );
}
