import { useQuery } from '@tanstack/react-query';
import { pipelineApi } from '../../lib/api/pipeline.api';
import { projectsApi } from '../../lib/api/projects.api';
import { PIPELINE_STAGES } from '../../lib/constants/pipeline.constants';

export function useDashboard() {
  const projectsQ = useQuery({
    queryKey: ['projects'],
    queryFn:  () => projectsApi.list(),
  });

  // Fetch all active pipeline entries (up to 200 — more than enough for a demo)
  const pipelineQ = useQuery({
    queryKey: ['pipeline', 'dashboard'],
    queryFn:  () => pipelineApi.list({ limit: 200 }),
  });

  const projects = projectsQ.data ?? [];
  const entries  = pipelineQ.data?.data ?? [];

  // KPI derivations
  const openIrcs     = projects.flatMap(p => p.ircs).filter(i => i.status === 'Open').length;
  const activePipeline = entries.filter(e => e.stage !== 'Rejected' && e.stage !== 'Allocated').length;
  const awaitingReview = entries.filter(e => e.stage === 'AI Shortlisted').length;
  const filled         = entries.filter(e => e.stage === 'Allocated').length;

  // Hiring funnel: count per stage
  const funnel = PIPELINE_STAGES.reduce<Record<string, number>>((acc, stage) => {
    acc[stage] = entries.filter(e => e.stage === stage).length;
    return acc;
  }, {});

  // Pipeline count per project (via irc id → project mapping)
  const ircToProject = new Map<number, number>();
  projects.forEach(p => p.ircs.forEach(i => ircToProject.set(i.id, p.id)));
  const pipelinePerProject = new Map<number, number>();
  entries.forEach(e => {
    const pid = ircToProject.get(e.irc.id);
    if (pid != null) pipelinePerProject.set(pid, (pipelinePerProject.get(pid) ?? 0) + 1);
  });

  return {
    projectsQ,
    pipelineQ,
    projects,
    kpis:               { openIrcs, activePipeline, awaitingReview, filled },
    funnel,
    pipelinePerProject,
  };
}
