import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Irc, Project } from '@prisma/client';
import { z } from 'zod';

// ─── Shared types (imported by HeuristicService and SearchService) ────────────

export interface PoolCandidate {
  employeeId:        number;
  skills:            string[];
  experienceYears:   number;
  currentAllocation: string | null;
  availableDate:     Date | null;
  joiningNotice:     string | null;
  projectHistory:    { projectName: string; duration?: string | null; description: string }[];
}

// ─── Zod output schema (spec requirement) ─────────────────────────────────────

const RankedItemSchema = z.object({
  employeeId:   z.number().int(),
  matchPct:     z.number().int().min(0).max(100),
  whyRecommend: z.string().min(10),
  whyNot:       z.array(z.string()),
  conflict:     z.boolean(),
  conflictNote: z.string().optional(),
});

export const GeminiResponseSchema = z.array(RankedItemSchema);
export type RankedItem = z.infer<typeof RankedItemSchema>;

// ─── Service ──────────────────────────────────────────────────────────────────

type IrcWithProject = Irc & { project: Pick<Project, 'name' | 'startDate'> };

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly genAI: GoogleGenerativeAI;

  constructor(private readonly config: ConfigService) {
    this.genAI = new GoogleGenerativeAI(this.config.get<string>('geminiApiKey') ?? '');
  }

  async rank(
    irc: IrcWithProject,
    pool: PoolCandidate[],
    query?: string,
    jdText?: string,
  ): Promise<RankedItem[]> {
    const modelName = this.config.get<string>('geminiModel') ?? 'gemini-1.5-flash';
    const model = this.genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: 'application/json' },
    });

    const prompt = this.buildPrompt(irc, pool, query, jdText);
    const result = await model.generateContent(prompt);
    const text   = result.response.text();

    // Throws ZodError on mismatch — search.service.ts catches and falls back (R6)
    return GeminiResponseSchema.parse(JSON.parse(text));
  }

  private buildPrompt(
    irc: IrcWithProject,
    pool: PoolCandidate[],
    query?: string,
    jdText?: string,
  ): string {
    const startDate   = irc.project.startDate?.toISOString().slice(0, 10) ?? 'TBD';
    const requirement = [query, jdText].filter(Boolean).join('\n\n')
      || '(No additional requirement provided)';

    const candidates = pool.map(c => ({
      employeeId:        c.employeeId,
      skills:            c.skills,
      experienceYears:   c.experienceYears,
      currentAllocation: c.currentAllocation,
      availableDate:     c.availableDate?.toISOString().slice(0, 10) ?? null,
      joiningNotice:     c.joiningNotice,
      projectHistory:    c.projectHistory,
    }));

    return `SYSTEM:
You are an internal staffing analyst. Score candidates only on real, specific project evidence — not just skill tag overlap. A candidate with fewer skills but a directly relevant project should outscore one with more tags but no evidence. Return strict JSON per the schema.

USER:
## Open Requisition
Role: ${irc.roleTitle} | Mandatory: ${irc.mandatorySkills} | Preferred: ${irc.preferredSkills ?? 'N/A'}
Experience: ${irc.experienceRange} | Location: ${irc.location} | Remote policy: ${irc.remotePolicy}
Project: ${irc.project.name} (starts ${startDate})

## Manager requirement
${requirement}

## Candidate pool
${JSON.stringify(candidates, null, 2)}

Return a JSON array. Each element: { employeeId (int), matchPct (0-100 int), whyRecommend (≥10 chars citing project evidence), whyNot (string array — at least 1 item per R7), conflict (bool), conflictNote (string or omit) }.`;
  }
}
