import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Card, KpiCard } from '../../components/Card';
import { EmptyState, ErrorBanner, Spinner } from '../../components/Feedback';
import { Badge } from '../../components/Badge';
import { cn } from '../../lib/utils/cn';
import { PIPELINE_STAGES, STAGE_HEX } from '../../lib/constants/pipeline.constants';
import type { Project } from '../../lib/api/projects.api';
import { useAuth } from '../../auth/useAuth';
import { useDashboard } from './useDashboard';

// ─── Hiring funnel ────────────────────────────────────────────────────────────

function HiringFunnel({ funnel }: { funnel: Record<string, number> }) {
  const total = Object.values(funnel).reduce((s, n) => s + n, 0);
  const max   = Math.max(...Object.values(funnel), 1);
  return (
    <Card className="p-5">
      <h3 className="mb-4 text-sm font-semibold text-network-blue">Hiring funnel</h3>
      {total === 0 ? (
        <p className="py-4 text-center text-sm text-[var(--fg-3)]">No pipeline entries yet</p>
      ) : (
        <div className="space-y-3">
          {PIPELINE_STAGES.map(stage => {
            const count = funnel[stage] ?? 0;
            const color = STAGE_HEX[stage] ?? '#C8CAD3';
            return (
              <div key={stage}>
                <div className="mb-1.5 flex justify-between">
                  <span className="text-xs text-secure-gray">{stage}</span>
                  <span className="text-xs font-semibold text-network-blue">{count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-level-gray">
                  <div style={{
                    height: 8, borderRadius: 999,
                    width: `${(count / max) * 100}%`,
                    background: color,
                    opacity: 0.75,
                    transition: 'width 0.4s',
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── Project row ──────────────────────────────────────────────────────────────

function ProjectRow({ project, pipelineCount }: { project: Project; pipelineCount: number }) {
  const navigate = useNavigate();
  const startDate = project.startDate ? new Date(project.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  return (
    <div className="flex flex-col gap-2 border-b border-[var(--border-subtle)] px-5 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => navigate(`/projects/${project.id}`)}>
        <p className="truncate font-medium text-network-blue hover:text-celestial-blue">{project.name}</p>
        <p className="text-xs text-[var(--fg-3)]">{project.customer} · starts {startDate}</p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {project.ircs.map(irc => (
            <Badge key={irc.id}
              className={cn('text-[10px]', irc.status === 'Open' ? 'bg-commerce-green/10 text-commerce-green' : 'bg-level-gray text-secure-gray')}>
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

// ─── Manager Dashboard ────────────────────────────────────────────────────────

export function ManagerDashboard() {
  const navigate                                          = useNavigate();
  const { user }                                          = useAuth();
  const { projectsQ, pipelineQ, projects, kpis, funnel, pipelinePerProject } = useDashboard();

  if (projectsQ.isPending || pipelineQ.isPending) return <Spinner />;
  if (projectsQ.isError)  return <ErrorBanner message="Failed to load projects" onRetry={projectsQ.refetch} />;

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <div className="space-y-6">
      <p className="text-sm text-secure-gray">
        Welcome back, <span className="font-medium text-network-blue">{firstName}</span>.{' '}
        Here's where your projects stand today.
      </p>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }} className="lg-4-cols">
        <KpiCard label="Open Requisitions"   value={kpis.openIrcs} />
        <KpiCard label="Active Pipeline"     value={kpis.activePipeline} />
        <KpiCard label="Awaiting Review"     value={kpis.awaitingReview} sub="AI Shortlisted" />
        <KpiCard label="Positions Filled"    value={kpis.filled} />
      </div>
      <style>{'@media (min-width: 1024px) { .lg-4-cols { grid-template-columns: repeat(4, 1fr) !important; } }'}</style>

      {/* Hiring funnel + projects */}
      <div className="grid gap-6 lg:grid-cols-2">
        <HiringFunnel funnel={funnel} />
        <Card>
          <h3 className="border-b border-[var(--border-subtle)] px-5 py-3 text-sm font-semibold text-network-blue flex items-center justify-between">
            Active projects
            <Button variant="ghost" size="sm" onClick={() => navigate('/projects')} className="text-xs text-celestial-blue">View all</Button>
          </h3>
          {projects.length === 0
            ? <EmptyState title="No projects assigned" />
            : projects.map(p => (
                <ProjectRow key={p.id} project={p} pipelineCount={pipelinePerProject.get(p.id) ?? 0} />
              ))}
        </Card>
      </div>
    </div>
  );
}
