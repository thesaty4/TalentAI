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

    return `You are TalentLens AI's staffing analyst. Judge every candidate according to the given scope below and score honestly across the full range instead of clustering everyone high. Output raw JSON only — no markdown, no text outside the JSON.

Scope:
- We will look into the search input.
  EXAMPLE:
  - if asking for "give the python candidate", result: python skill should be mandatory.
  - if asking for "give the Noida location candidate", result: Noida location should be mandatory.
  - if user asking for domain specific, then result should be the domain specific.
  - if experience range will input then we have to mandatory experience.
  - Suppose we are asking for "Who has working experience" then look for candidate project description.
  - If someone ask for "IRC specific candidate", we have to look into IRC specific fields, after this we have to look for project description that will be addon advantage for ranking candidate. How to distinguish that we are not searching IRC specific? It means search input will be having some keywords like skill | location | exp | domain or anything that manager is asking explicitly. If manager writes something generic which does not explicitly define any filter keywords, then it is IRC specific. Example: "give me matching candidates", "give me candidates who is fit for JD".

USER INPUT:
## What the manager is asking for. [PRIMARY — apply this first]
${effectiveQuery || '(No specific ask — use the role context below as the primary criteria instead.)'}

## Candidate pool
${JSON.stringify(candidates, null, 2)}

Return a JSON array only.

Rules:
- Score matchPct 0-100.
- whyRecommend is exactly one sentence naming the specific evidence behind the score — never invent stronger evidence than what's actually in the candidate's record.
- whyNot lists one or more short, genuine gaps or risks — every candidate needs at least one, including strong matches.
- Set conflict to true and give a one-sentence conflictNote only when the candidate's availability genuinely can't meet when this role needs someone to start; otherwise conflict is false and conflictNote is left out entirely.
- Include every candidate from the pool above unless the primary ask above names a mandatory criterion this candidate fails — in that case, leave them out of the array rather than scoring them.
- If a mandatory criterion leaves nobody eligible, return an empty array — don't loosen the criteria and don't substitute a "closest fit" candidate instead.
- The full response must begin with the opening [ and end with the closing ] — nothing else outside those brackets.
- Never truncate the list with ... or shorthand, never use // comments, never add commentary before or after the array.

BEFORE writing the array, do this filtering step silently:
1. Identify every mandatory criterion in the manager's ask — this could be a skill, a location, an experience range, or a domain. There can be more than one.
2. For a skill criterion: check if the candidate's "skills" array contains that exact term (case-insensitive). Related-but-different terms (e.g. "Payments APIs" or "FastAPI" when the ask is "Python") do NOT count as a match.
3. For a location criterion: check if the candidate's "location" field exactly matches (case-insensitive) the named location. "Remote" does not satisfy a specific city requirement unless the ask itself says "remote."
4. For an experience criterion: check if the candidate's "experienceYears" falls within the stated range.
5. For a domain criterion: check if the candidate's businessUnit or project history reflects that domain.
6. A candidate must pass ALL mandatory criteria named in the ask to be included. If they fail even one, exclude them — regardless of how strong their other qualifications look.
7. If the ask is generic (no explicit skill/location/experience/domain keyword), treat it as IRC-specific: apply no mandatory filter, and rank using role fit and project history instead.

Do not include any fields other than the ones in the required shape below. Adding fields like fullName, roleTitle, location, businessUnit, isDuplicate, duplicateNote, alreadyInPipeline, or pipelineCandidateId is a violation of the output format.

Before finalizing, re-scan your array: for every included employeeId, confirm their record actually satisfies every mandatory criterion identified in step 1. Remove any that don't.

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
