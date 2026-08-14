import { z } from 'zod';

// Shared types used by LlamaService, HeuristicService, and SearchService

export interface QueryConstraints {
  expExact?:        number;
  expRange?:        { min: number; max: number };
  locations?:       { cities: string[]; isOverride: boolean };
  domains?:         string[];
  remotePolicy?:    'Remote' | 'Hybrid' | 'On-site';
  joiningNoticeDays?: number;
  isStrict:         boolean;
  // True when user says "all candidates" — bypasses IRC mandatory-skills pre-filter
  isAllCandidates:  boolean;
}

export interface PoolCandidate {
  employeeId:        number;
  location:          string;
  benchStatus:       string;
  skills:            string[];
  experienceYears:   number;
  currentAllocation: string | null;
  availableDate:     Date | null;
  joiningNotice:     string | null;
  projectHistory:    {
    projectName:  string;
    clientName?:  string | null;
    duration?:    string | null;
    description:  string;
    domainTags:   string[];
  }[];
}

const RankedItemSchema = z.object({
  employeeId:   z.number().int(),
  matchPct:     z.number().int().min(0).max(100),
  whyRecommend: z.string(), // post-processed to guarantee ≥10 chars
  whyNot:       z.array(z.string()), // post-processed to guarantee ≥1 item
  conflict:     z.boolean(),
  conflictNote: z.string().optional(),
});

export const RankingResponseSchema = z.array(RankedItemSchema);
export type RankedItem = z.infer<typeof RankedItemSchema>;
