import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { KpiCard } from '../../components/Card';
import { ErrorBanner, Spinner, EmptyState } from '../../components/Feedback';
import { Button } from '../../components/Button';
import { StageChip } from '../../components/Badge';
import { useAuth } from '../../auth/useAuth';
import { candidateApi } from '../../lib/api/candidate.api';

export function CandidateDashboard() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const firstName  = user?.name?.split(' ')[0] ?? 'there';

  const openIrcsQ  = useQuery({ queryKey: ['candidate-open-ircs'],  queryFn: () => candidateApi.openIrcs() });
  const pipelineQ  = useQuery({ queryKey: ['my-pipeline'],          queryFn: () => candidateApi.myPipeline() });
  const upcomingQ  = useQuery({ queryKey: ['upcoming'],             queryFn: () => candidateApi.upcoming() });

  if (openIrcsQ.isPending || pipelineQ.isPending) return <Spinner />;
  if (openIrcsQ.isError || pipelineQ.isError) return <ErrorBanner message="Failed to load dashboard" onRetry={() => { openIrcsQ.refetch(); pipelineQ.refetch(); }} />;

  const openIrcs    = openIrcsQ.data ?? [];
  const pipeline    = pipelineQ.data ?? [];
  const upcoming    = upcomingQ.data ?? [];

  const applied     = openIrcs.filter(i => i.hasApplied).length;
  const activeCount = pipeline.filter(e => e.stage !== 'Rejected' && e.stage !== 'Allocated').length;

  return (
    <div className="space-y-6">
      <p className="text-sm text-secure-gray">
        Welcome back, <span className="font-medium text-network-blue">{firstName}</span>.{' '}
        Here's your current status.
      </p>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Open Positions"   value={openIrcs.length} />
        <KpiCard label="Applied"          value={applied} />
        <KpiCard label="Active Pipeline"  value={activeCount} />
        <KpiCard label="Upcoming Sessions" value={upcoming.length} />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Button size="sm" onClick={() => navigate('/open-ircs')}>Browse Open IRCs</Button>
        <Button size="sm" variant="secondary" onClick={() => navigate('/my-pipeline')}>My Pipeline</Button>
        <Button size="sm" variant="secondary" onClick={() => navigate('/feedback')}>My Feedback</Button>
        {upcoming.length > 0 && (
          <Button size="sm" variant="secondary" onClick={() => navigate('/upcoming')}>
            Upcoming ({upcoming.length})
          </Button>
        )}
      </div>

      {/* Recent pipeline entries */}
      {pipeline.length === 0 ? (
        <EmptyState title="No applications yet" description="Browse Open IRCs to apply to available positions." />
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-secure-gray">My Applications</h2>
          {pipeline.slice(0, 5).map(e => (
            <div key={e.id} className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-white px-4 py-3">
              <div>
                <p className="font-medium text-network-blue">{e.irc.roleTitle}</p>
                <p className="text-xs text-[var(--fg-3)]">{e.irc.project.name}</p>
              </div>
              <StageChip stage={e.stage} />
            </div>
          ))}
          {pipeline.length > 5 && (
            <Button variant="ghost" size="sm" onClick={() => navigate('/my-pipeline')}>
              View all {pipeline.length} applications
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
