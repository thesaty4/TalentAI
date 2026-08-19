export const PIPELINE_STAGES = [
  'AI Shortlisted',
  'Manager Screening',
  'Internal Tech Evaluation',
  'Client Interview',
  'Selected',
  'Allocated',
  'Rejected',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

// Solid hex per stage — used for badges, kanban column headers, and funnel bars
export const STAGE_HEX: Record<string, string> = {
  'AI Shortlisted':           '#0891B2',  // Teal — calm, AI-associated, easy on the eye
  'Manager Screening':        '#484F6B',  // Steel Gray 75
  'Internal Tech Evaluation': '#FF5F2D',  // Impact Orange
  'Client Interview':         '#00018B',  // Deep Blue
  'Selected':                 '#2E776A',  // Green
  'Allocated':                '#181A24',  // Steel Gray 100
  'Rejected':                 '#EF4444',
};

// Tailwind className map (kept for backward-compat with any remaining usages)
export const STAGE_COLORS: Record<string, string> = {
  'AI Shortlisted':           'bg-[#0891B2] text-white',
  'Manager Screening':        'bg-secure-gray text-white',
  'Internal Tech Evaluation': 'bg-power-orange text-white',
  'Client Interview':         'bg-stacked-blue text-white',
  'Selected':                 'bg-commerce-green text-white',
  'Allocated':                'bg-network-blue text-white',
  'Rejected':                 'bg-secure-gray text-white',
};
