import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Irc, Project } from '@prisma/client';
import { z } from 'zod';
import { JD_TEXT_MAX_LENGTH } from '../common/constants/search.constants';
import { PoolCandidate, RankedItem } from './search.types';

// Shared ranked-item output schema — orchestrator handles AI/heuristic paths uniformly
const RankedItemSchema = z.object({
  employeeId:   z.number().int(),
  matchPct:     z.number().int().min(0).max(100),
  whyRecommend: z.string(), // post-processed below to guarantee ≥10 chars
  whyNot:       z.array(z.string()), // post-processed below to guarantee at least 1 item (R7)
  conflict:     z.boolean(),
  conflictNote: z.string().optional(),
});
export const LlamaResponseSchema = z.array(RankedItemSchema);

const DEFAULT_WHY_NOT       = 'No specific gaps identified — verify domain depth independently';
const WHY_RECOMMEND_SUFFIX  = ' — based on available project history';

type IrcWithProject = Irc & { project: Pick<Project, 'name' | 'startDate'> };

@Injectable()
export class LlamaService {
  private readonly logger = new Logger(LlamaService.name);

  constructor(private readonly config: ConfigService) {}

  async rank(
    irc: IrcWithProject,
    pool: PoolCandidate[],
    query?: string,
    jdText?: string,
    constraintNote?: string,
  ): Promise<RankedItem[]> {
    const prompt = this.buildPrompt(irc, pool, query, jdText, constraintNote);
    const raw = await this.callGenerate(prompt);

    try {
      return this.postProcess(LlamaResponseSchema.parse(JSON.parse(this.cleanJson(raw))));
    } catch {
      // Single retry — Llama occasionally wraps JSON in markdown on first call
      this.logger.warn('First JSON parse failed, retrying once');
      const rawRetry = await this.callGenerate(prompt);
      return this.postProcess(LlamaResponseSchema.parse(JSON.parse(this.cleanJson(rawRetry))));
    }
  }

  /** Ensures whyRecommend ≥10 chars (R6) and whyNot ≥1 item (R7). */
  private postProcess(items: RankedItem[]): RankedItem[] {
    return items.map(item => ({
      ...item,
      whyRecommend: item.whyRecommend.length >= 10
        ? item.whyRecommend
        : `${item.whyRecommend}${WHY_RECOMMEND_SUFFIX}`,
      whyNot: item.whyNot.length > 0 ? item.whyNot : [DEFAULT_WHY_NOT],
    }));
  }

  private async callGenerate(prompt: string): Promise<string> {
    const baseUrl = this.config.get<string>('llamaBaseUrl');
    const apiKey  = this.config.get<string>('llamaApiKey');
    const model   = this.config.get<string>('llamaModel') ?? 'llama3';

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/generate`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ model, prompt, stream: false }),
      });
    } catch (err: unknown) {
      throw new Error(`Llama service unreachable at ${baseUrl}: ${(err as Error).message}`);
    }

    if (!res.ok) {
      throw new Error(`Llama API returned ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as { response: string };
    return data.response ?? '';
  }

  /** Extracts the JSON array from raw output, stripping any preamble or markdown fences. */
  private cleanJson(raw: string): string {
    // Strip markdown fences first
    let cleaned = raw
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim();

    // Extract array by bracket position — handles preamble like "Here is the ranking:"
    const start = cleaned.indexOf('[');
    const end   = cleaned.lastIndexOf(']');
    if (start !== -1 && end > start) {
      return cleaned.slice(start, end + 1);
    }
    return cleaned;
  }

  private buildPrompt(
    irc: IrcWithProject,
    pool: PoolCandidate[],
    query?: string,
    jdText?: string,
    constraintNote?: string,
  ): string {
    const startDate = irc.project.startDate?.toISOString().slice(0, 10) ?? 'TBD';

    const normalizedJd = jdText
      ? jdText.trim().replace(/[\r\n]+/g, '\n').replace(/[ \t]+/g, ' ').slice(0, JD_TEXT_MAX_LENGTH)
      : undefined;

    // Query is ALWAYS the primary intent. JD is background context only.
    const querySection = query?.trim()
      ? `## MANAGER'S PRIMARY REQUIREMENT (highest priority — treat this as the search goal)\n${query.trim()}`
      : '';
    const jdSection = normalizedJd
      ? `## Job Description (background context — secondary to the manager's requirement above)\n${normalizedJd}`
      : '';
    const requirementSection = [querySection, jdSection].filter(Boolean).join('\n\n')
      || '(No additional requirement provided)';

    const strictBlock = constraintNote?.includes('STRICT')
      ? `\n⚠️  STRICT MODE ACTIVE — The manager used strict language (only / strictly / must / exact).\n    ANY candidate that violates a constraint below must receive matchPct = 0.\n    Do NOT compensate with other strengths. Do NOT soften the constraint.\n    Applied constraints: ${constraintNote}\n`
      : '';

    const appliedFiltersBlock = constraintNote && !constraintNote.includes('STRICT')
      ? `\n## Applied Filters (pre-enforced — all candidates below already satisfy these)\n${constraintNote}\nYour job: rank by quality only. Do NOT re-evaluate these constraints.`
      : '';

    const candidates = pool.map(c => ({
      employeeId:        c.employeeId,
      location:          c.location,
      benchStatus:       c.benchStatus,
      skills:            c.skills,
      experienceYears:   c.experienceYears,
      currentAllocation: c.currentAllocation,
      availableDate:     c.availableDate?.toISOString().slice(0, 10) ?? null,
      joiningNotice:     c.joiningNotice,
      projectHistory:    c.projectHistory.map(p => ({
        projectName: p.projectName,
        clientName:  p.clientName ?? undefined,
        duration:    p.duration,
        domainTags:  p.domainTags,
        description: p.description,
      })),
    }));

    return `You are a staffing analyst producing a deterministic JSON ranking. Follow every rule exactly.

RESPOND WITH ONLY A VALID JSON ARRAY. No explanation, no markdown, no code blocks. Begin your response with [ and nothing else.
${strictBlock}
## Open Requisition
Role: ${irc.roleTitle}
Mandatory Skills: ${irc.mandatorySkills}
Preferred Skills: ${irc.preferredSkills ?? 'N/A'}
Experience Required: ${irc.experienceRange}
Location: ${irc.location}
Remote Policy: ${irc.remotePolicy}
Project: ${irc.project.name} (starts ${startDate})

${requirementSection}
${appliedFiltersBlock}

## Scoring Rules (apply in this priority order)

RULE 1 — Manager's explicit requirement is the PRIMARY SIGNAL.
  If the manager typed a requirement, every scoring decision must first satisfy that intent.
  The JD is supplementary background — it never overrides what the manager explicitly asked for.

RULE 2 — Mandatory skills gate (score capped at 30 if ANY mandatory skill missing):
  Exact match only. Java ≠ JavaScript. React ≠ React Native. PostgreSQL ≠ generic SQL.
  Normalize only trivial differences: casing, spaces, hyphens.

RULE 3 — Location gate (score capped at 40 if location mismatch).

RULE 4 — Experience gate (score capped at 40 if outside required range).

RULE 5 — Secondary ranking for eligible candidates (scores 41–100):
  a. Relevant project evidence (0–40 pts): cite the specific project by name in whyRecommend.
  b. Domain experience (0–15 pts): matching industry/domain from projectHistory.
  c. Preferred skills coverage (0–5 pts).

RULE 6 — Determinism: equal matchPct → rank by employeeId ascending.

RULE 7 — Do NOT infer skills or experience not present in candidate data.

## Candidate Pool
${JSON.stringify(candidates, null, 2)}

Return ONLY this JSON array — no other text before or after it:
[
  {
    "employeeId": <integer matching a candidate above>,
    "matchPct": <integer 0-100 per scoring rules above>,
    "whyRecommend": "<min 10 chars; cite the specific project that justifies the match>",
    "whyNot": ["<at least one honest gap>"],
    "conflict": <true if availableDate is after project startDate, else false>,
    "conflictNote": "<describe gap if conflict is true; omit field otherwise>"
  }
]

Begin your response with the opening bracket [ and nothing else:`;
  }
}
