export const PIPELINE_STAGES = [
  'AI Shortlisted',
  'Manager Screening',
  'Internal Tech Evaluation',
  'Client Interview',
  'Selected',
  'Allocated',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number] | 'Rejected';

// Solid hex per stage — used for badges, kanban column headers, and funnel bars
export const STAGE_HEX: Record<string, string> = {
  'AI Shortlisted':           '#4197CB',
  'Manager Screening':        '#D9A400',
  'Internal Tech Evaluation': '#FF6B00',
  'Client Interview':         '#003057',
  'Selected':                 '#00945E',
  'Allocated':                '#00263A',
  'Rejected':                 '#8A8C8E',
};

// Tailwind className map (kept for backward-compat with any remaining usages)
export const STAGE_COLORS: Record<string, string> = {
  'AI Shortlisted':           'bg-celestial-blue text-white',
  'Manager Screening':        'bg-[#D9A400] text-white',
  'Internal Tech Evaluation': 'bg-energy-orange text-white',
  'Client Interview':         'bg-stacked-blue text-white',
  'Selected':                 'bg-commerce-green text-white',
  'Allocated':                'bg-network-blue text-white',
  'Rejected':                 'bg-[#8A8C8E] text-white',
};
