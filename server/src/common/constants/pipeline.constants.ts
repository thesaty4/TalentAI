export const PIPELINE_STAGES = [
  'AI Shortlisted',
  'Manager Screening',
  'Internal Tech Evaluation',
  'Client Interview',
  'Selected',
  'Allocated',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number] | 'Rejected';
