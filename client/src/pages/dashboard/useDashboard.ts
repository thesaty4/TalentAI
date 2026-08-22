import { useQuery } from '@tanstack/react-query';
import { pipelineApi } from '../../lib/api/pipeline.api';
import { projectsApi } from '../../lib/api/projects.api';
import { PIPELINE_STAGES } from '../../lib/constants/pipeline.constants';

export function useDashboard(filterProjectId?: number | null, filterIrcId?: number | null) {
  const projectsQ = useQuery({
    queryKey: ['projects'],
    queryFn:  () => projectsApi.list(),
  });

  // Pipeline scoped by optional project/IRC filter — backend enforces role access
  const pipelineQ = useQuery({
    queryKey: ['pipeline', 'dashboard', filterProjectId ?? null, filterIrcId ?? null],
    queryFn:  () => pipelineApi.list({
      limit: 100,
      ...(filterProjectId && { projectId: filterProjectId }),
      ...(filterIrcId    && { ircId: filterIrcId }),
    }),
  });

  // Scope project list to the selected project if a filter is active
  const allProjects = projectsQ.data ?? [];
  const projects    = filterProjectId
    ? allProjects.filter(p => p.id === filterProjectId)
    : allProjects;

  const entries  = pipelineQ.data?.data ?? [];

  // IRC counts scoped to the visible project set + optional IRC filter
  const allIrcs   = projects.flatMap(p => p.ircs);
  const scopedIrcs = filterIrcId ? allIrcs.filter(i => i.id === filterIrcId) : allIrcs;
  const openIrcs   = scopedIrcs.filter(i => i.status === 'Open').length;
  const totalIrcs  = scopedIrcs.length;

  // Pipeline-stage KPIs
  const activePipeline = entries.filter(e => e.stage !== 'Rejected' && e.stage !== 'Allocated').length;
  const awaitingReview = entries.filter(e => e.stage === 'AI Shortlisted').length;
  const filled         = entries.filter(e => e.stage === 'Allocated').length;
  const selectedCount  = entries.filter(e => e.stage === 'Selected').length;
  const rejectedCount  = entries.filter(e => e.stage === 'Rejected').length;

  // Hiring funnel: count per stage
  const funnel = PIPELINE_STAGES.reduce<Record<string, number>>((acc, stage) => {
    acc[stage] = entries.filter(e => e.stage === stage).length;
    return acc;
  }, {});

  // Pipeline count per project (via irc id → project mapping)
  const ircToProject = new Map<number, number>();
  allProjects.forEach(p => p.ircs.forEach(i => ircToProject.set(i.id, p.id)));
  const pipelinePerProject = new Map<number, number>();
  entries.forEach(e => {
    const pid = ircToProject.get(e.irc.id);
    if (pid != null) pipelinePerProject.set(pid, (pipelinePerProject.get(pid) ?? 0) + 1);
  });

  return {
    projectsQ,
    pipelineQ,
    projects,
    allProjects,
    kpis: { openIrcs, totalIrcs, activePipeline, awaitingReview, filled, selectedCount, rejectedCount },
    funnel,
    pipelinePerProject,
  };
}
