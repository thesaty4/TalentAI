export const PIPELINE_STAGES = [
  'AI Shortlisted',
  'Manager Screening',
  'Internal Tech Evaluation',
  'Client Interview',
  'Selected',
  'Allocated',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number] | 'Rejected';

export const STAGE_COLORS: Record<string, string> = {
  'AI Shortlisted':           'bg-celestial-blue text-white',
  'Manager Screening':        'bg-[#D9A400] text-white',
  'Internal Tech Evaluation': 'bg-energy-orange text-white',
  'Client Interview':         'bg-stacked-blue text-white',
  'Selected':                 'bg-commerce-green text-white',
  'Allocated':                'bg-network-blue text-white',
  'Rejected':                 'bg-[#8A8C8E] text-white',
};
