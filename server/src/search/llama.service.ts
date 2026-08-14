import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Irc, Project } from '@prisma/client';
import { z } from 'zod';
import { JD_TEXT_MAX_LENGTH } from '../common/constants/search.constants';
import { writeSearchLog } from '../common/utils/search-logger.util';

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

// ─── Zod output schema ────────────────────────────────────────────────────────

const RankedItemSchema = z.object({
  // coerce: handles string "5" from Llama instead of int 5
  employeeId:   z.coerce.number().int().catch(0),
  matchPct:     z.coerce.number().int().min(0).max(100).catch(50),
  // .catch('') converts non-strings; .transform fills empty/whitespace with a safe default
  whyRecommend: z.string().catch('').transform(s => s.trim() || 'No specific evidence cited.'),
  whyNot:       z.array(z.string()).catch(['No gap information provided.']),
  conflict:     z.boolean().catch(false),
  conflictNote: z.string().optional().catch(undefined),
});

export const LlamaResponseSchema = z.array(RankedItemSchema);
export type RankedItem = z.infer<typeof RankedItemSchema>;

// ─── Service ──────────────────────────────────────────────────────────────────

type IrcWithProject = Irc & { project: Pick<Project, 'name' | 'startDate'> };

// temperature=0 + fixed seed = greedy decoding, same input always produces same ranking
const LLAMA_SEED = Number(process.env.LLAMA_SEED ?? 42);

@Injectable()
export class LlamaService {
  private readonly logger = new Logger(LlamaService.name);

  constructor(private readonly config: ConfigService) {}

  async rank(
    irc: IrcWithProject,
    pool: PoolCandidate[],
    query?: string,
    jdText?: string,
  ): Promise<RankedItem[]> {
    const effectiveQuery = this.buildEffectiveQuery(query, jdText);
    const prompt         = this.buildPrompt(irc, pool, query, jdText);

    // Console: one-liner with the actual query driving the search
    this.logger.log(`Ranking ${pool.length} candidates for ${irc.ircCode} | effectiveQuery: "${effectiveQuery.slice(0, 120)}"`);

    // File: full prompt so you can inspect exactly what Llama received
    writeSearchLog({ phase: 'llama-prompt', ircCode: irc.ircCode, promptLength: prompt.length, prompt });

    const text   = await this.callLlama(prompt);
    const result = await this.parseWithRetry(text, () => this.callLlama(prompt));

    this.logger.log(`Ranking complete — ${result.length} results | top: ${result.slice(0, 3).map(r => `id=${r.employeeId}(${r.matchPct}%)`).join(', ')}`);
    return result;
  }

  // ─── effectiveQuery: query is PRIMARY, JD is SECONDARY context ───────────

  private buildEffectiveQuery(query?: string, jdText?: string): string {
    const normalizedJd = jdText
      ? jdText.trim().replace(/\s+/g, ' ').slice(0, JD_TEXT_MAX_LENGTH)
      : '';

    if (query && normalizedJd) {
      return `Manager requirement: ${query}\n\nJob description:\n${normalizedJd}`;
    }
    if (query) return query;
    if (normalizedJd) return normalizedJd;
    return '';
  }

  private buildPrompt(
    irc: IrcWithProject,
    pool: PoolCandidate[],
    query?: string,
    jdText?: string,
  ): string {
    const effectiveQuery = this.buildEffectiveQuery(query, jdText);
    const startDate      = irc.project.startDate?.toISOString().slice(0, 10) ?? 'TBD';

    const candidates = pool.map(c => ({
      employeeId:        c.employeeId,
      experienceYears:   c.experienceYears,
      skills:            c.skills,
      currentAllocation: c.currentAllocation,
      availableDate:     c.availableDate?.toISOString().slice(0, 10) ?? null,
      joiningNotice:     c.joiningNotice,
      projectHistory:    c.projectHistory,
    }));

    return `You are TalentLens AI's staffing analyst. Judge every candidate on real project-history evidence, not on skill tags — someone who has actually done this kind of work outranks someone who only lists the right keywords. Score honestly across the full range instead of clustering everyone high. Output raw JSON only — no markdown, no text outside the JSON.

USER:
## What the manager is asking for [PRIMARY — apply this first]
${effectiveQuery || '(No specific ask — use the role context below as the primary criteria instead.)'}

MANDATORY FILTER: Every skill, technology, domain, or location named above is a hard requirement. If a candidate does not have it — in their skills list or project history — leave them out of the array entirely. Do not score them low. Do not include a "closest match". If nobody qualifies, return []. Only candidates who genuinely satisfy the requirement should appear.

## Role context [SECONDARY — refine the ranking with this, don't override the above]
Role: ${irc.roleTitle}
Mandatory skills: ${irc.mandatorySkills}
Preferred skills: ${irc.preferredSkills ?? 'N/A'}
Experience range: ${irc.experienceRange}
Location: ${irc.location} | Remote: ${irc.remotePolicy}
Project starts: ${startDate}

## Candidate pool
${JSON.stringify(candidates, null, 2)}

Return a JSON array only. Rules:
- Score matchPct 0-100: 90+ needs direct, specific project evidence of doing this kind of work; 70-89 is solid adjacent evidence; 40-69 is skill-tag overlap with little real evidence (or good evidence undercut by a real gap); under 40 is little to no genuine fit.
- whyRecommend is exactly one sentence naming the specific evidence behind the score — never invent stronger evidence than what's actually in the candidate's record.
- whyNot lists one or more short, genuine gaps or risks — every candidate needs at least one, including strong matches.
- Set conflict to true and give a one-sentence conflictNote only when the candidate's availability genuinely can't meet when this role needs someone to start; otherwise conflict is false and conflictNote is left out entirely.
- Include every candidate from the pool above unless the primary ask above names a mandatory criterion this candidate fails — in that case, leave them out of the array rather than scoring them.
- If a mandatory criterion leaves nobody eligible, return an empty array — don't loosen the criteria and don't substitute a "closest fit" candidate instead.
- The full response must begin with the opening [ and end with the closing ] — nothing else outside those brackets.
- Never truncate the list with ... or shorthand, never use // comments, never add commentary before or after the array.
Required shape per element: { "employeeId": int, "matchPct": 0-100 int, "whyRecommend": "one sentence citing real evidence", "whyNot": ["one or more genuine gaps"], "conflict": bool, "conflictNote": "one sentence, left out entirely when conflict is false" }`;
  }

  // ─── Llama API call (Ollama REST contract) ────────────────────────────────

  private async callLlama(prompt: string): Promise<string> {
    const baseUrl = this.config.get<string>('llamaBaseUrl')!;
    const apiKey  = this.config.get<string>('llamaApiKey');
    const model   = this.config.get<string>('llamaModel') ?? 'llama3';

    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ model, prompt, stream: false, options: { temperature: 0, seed: LLAMA_SEED } }),
    });

    if (!res.ok) {
      this.logger.error(`Llama API error: ${res.status} ${res.statusText}`);
      throw new Error(`Llama API ${res.status}: ${res.statusText}`);
    }

    const data = await res.json() as { response: string };
    return data.response ?? '';
  }

  // ─── Parse + one retry on validation failure ──────────────────────────────

  private async parseWithRetry(
    text: string,
    retry: () => Promise<string>,
  ): Promise<RankedItem[]> {
    let parsed: unknown;
    try {
      parsed = this.extractJson(text);
    } catch (e) {
      this.logger.warn(`Llama response was not valid JSON — retrying. Raw output:\n${text}\nError: ${(e as Error).message}`);
      const retryText = await retry();
      parsed = this.extractJson(retryText); // throws if still bad — SearchService falls back
    }
    return LlamaResponseSchema.parse(parsed);
  }

  // Extract + sanitise the JSON array from Llama output
  private extractJson(text: string): unknown {
    const sanitised = text
      .replace(/\/\/[^\n]*/g, '')          // strip JS // comments (invalid JSON)
      .replace(/\/\*[\s\S]*?\*\//g, '')    // strip /* block comments */
      .replace(/\{\s*\.{2,}\s*\}/g, '')        // remove {...} placeholder objects
      .replace(/,\s*\.{3,}\s*(?=[\]},])/g, '')  // remove trailing , ... before ] or }
      .replace(/\]\s*,\s*\[/g, ',')              // merge split arrays: ["a"],["b"] → ["a","b"]
      .replace(/,\s*([\]}])/g, '$1');             // clean up trailing commas

    const match = sanitised.match(/(\[[\s\S]*\])/);
    if (match) {
      return JSON.parse(match[1]);
    }
    const stripped = sanitised
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim();
    return JSON.parse(stripped);
  }
}
