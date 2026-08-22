import { useState } from 'react';
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
import { useQuery } from '@tanstack/react-query';
import { poolApi } from '../../lib/api/pool.api';

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
  const navigate                = useNavigate();
  const { user }                = useAuth();

  const [filterProjectId, setFilterProjectId] = useState<number | null>(null);
  const [filterIrcId,     setFilterIrcId]     = useState<number | null>(null);

  const { projectsQ, pipelineQ, projects, allProjects, kpis, funnel, pipelinePerProject } =
    useDashboard(filterProjectId, filterIrcId);

  const forecastQ = useQuery({
    queryKey: ['pool', 'forecast'],
    queryFn:  () => poolApi.list({ benchStatus: 'Allocated', limit: 100 })
                     .then(r => r.data.filter(e => !!e.availableDate).length),
  });
  const benchQ = useQuery({ queryKey: ['pool', 'bench'], queryFn: () => poolApi.count('Bench') });

  if (projectsQ.isPending || pipelineQ.isPending) return <Spinner />;
  if (projectsQ.isError)  return <ErrorBanner message="Failed to load projects" onRetry={projectsQ.refetch} />;

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  const ircOptions = filterProjectId
    ? (allProjects.find(p => p.id === filterProjectId)?.ircs ?? [])
    : [];

  return (
    <div className="space-y-6">
      <p className="text-sm text-secure-gray">
        Welcome back, <span className="font-medium text-network-blue">{firstName}</span>.{' '}
        Here's where your projects stand today.
      </p>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterProjectId ?? ''}
          onChange={e => { setFilterProjectId(e.target.value ? +e.target.value : null); setFilterIrcId(null); }}
          className="h-8 rounded-lg border border-[var(--border-default)] bg-white px-3 text-sm text-network-blue focus:border-power-orange focus:outline-none">
          <option value="">All projects</option>
          {allProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select
          value={filterIrcId ?? ''}
          onChange={e => setFilterIrcId(e.target.value ? +e.target.value : null)}
          disabled={!filterProjectId}
          className="h-8 rounded-lg border border-[var(--border-default)] bg-white px-3 text-sm text-network-blue focus:border-power-orange focus:outline-none disabled:opacity-50">
          <option value="">All IRCs</option>
          {ircOptions.map(i => <option key={i.id} value={i.id}>{i.ircCode} — {i.roleTitle}</option>)}
        </select>
        {(filterProjectId || filterIrcId) && (
          <button onClick={() => { setFilterProjectId(null); setFilterIrcId(null); }}
            className="text-xs text-power-orange hover:underline">Clear filters</button>
        )}
      </div>

      {/* KPI cards — row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }} className="lg-4-cols">
        <KpiCard label="Number of IRCs"   value={`${kpis.openIrcs}/${kpis.totalIrcs}`} sub="Open / Total" />
        <KpiCard label="Active Pipeline"  value={kpis.activePipeline} />
        <KpiCard label="Awaiting Review"  value={kpis.awaitingReview} sub="AI Shortlisted" />
        <KpiCard label="Positions Filled" value={kpis.filled} />
      </div>
      <style>{'@media (min-width: 1024px) { .lg-4-cols { grid-template-columns: repeat(4, 1fr) !important; } }'}</style>

      {/* KPI cards — row 2: pipeline-stage counts with navigation */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }} className="lg-4-cols">
        <KpiCard label="Selected"   value={kpis.selectedCount}  accent="#2E776A" onClick={() => navigate('/pipeline?stage=Selected')} />
        <KpiCard label="Allocated"  value={kpis.filled}                          onClick={() => navigate('/pipeline?stage=Allocated')} />
        <KpiCard label="Rejected"   value={kpis.rejectedCount}  accent="#EF4444" onClick={() => navigate('/pipeline?stage=Rejected')} />
        <KpiCard label="On Pool"    value={benchQ.data ?? '—'}                   onClick={() => navigate('/pool?benchStatus=Bench')} />
      </div>

      {/* Forecasted Pool */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Forecasted Pool" value={forecastQ.data ?? '—'} sub="Returning soon" onClick={() => navigate('/pool?benchStatus=Allocated')} />
      </div>

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
