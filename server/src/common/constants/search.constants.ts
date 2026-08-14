// LLM context-window budget — pre-filter keeps prompt tight
export const MAX_RANKING_CANDIDATES = 35;
export const JD_TEXT_MAX_LENGTH     = 4000;

// Domain keyword expansion — used to match project history descriptions against query domain
export const DOMAIN_KEYWORD_MAP: Record<string, readonly string[]> = {
  payment:    ['payment', 'payments', 'fintech', 'transaction', 'remittance', 'checkout', 'billing'],
  payments:   ['payment', 'payments', 'fintech', 'transaction', 'remittance', 'checkout', 'billing'],
  banking:    ['banking', 'bank', 'financial services', 'wealth management', 'lending', 'credit', 'loan'],
  healthcare: ['healthcare', 'health', 'medical', 'hospital', 'clinical', 'pharma', 'patient'],
  ecommerce:  ['ecommerce', 'e-commerce', 'retail', 'marketplace', 'shopping', 'cart'],
  insurance:  ['insurance', 'insure', 'underwriting', 'claims', 'policy'],
  logistics:  ['logistics', 'supply chain', 'warehouse', 'shipping', 'freight'],
  telecom:    ['telecom', 'telecommunications', 'carrier', 'network provider'],
  fintech:    ['fintech', 'payment', 'payments', 'digital banking', 'neobank', 'wallet'],
};
export const KNOWN_LOCATIONS = [
  'bangalore', 'bengaluru', 'mumbai', 'delhi', 'new delhi',
  'noida', 'hyderabad', 'pune', 'chennai', 'kolkata',
  'gurgaon', 'gurugram', 'ahmedabad', 'remote', 'hybrid',
] as const;

// Canonical aliases — treated as the same city when matching
export const LOCATION_ALIASES: Record<string, string> = {
  bengaluru:   'bangalore',
  gurugram:    'gurgaon',
  'new delhi': 'delhi',
};
