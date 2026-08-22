// GlobalLogic India office locations — used as the canonical location filter list
export const GL_INDIA_LOCATIONS = [
  'Bangalore',
  'Chennai',
  'Gurgaon',
  'Hyderabad',
  'Mahabubnagar',
  'Nagpur',
  'Noida',
  'Pune',
] as const;

export type GlIndiaLocation = (typeof GL_INDIA_LOCATIONS)[number];
