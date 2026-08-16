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

// Type for IRC with its related Project data
export type IrcWithProject = Irc & { project: Pick<Project, 'name' | 'startDate'> };

// ─── Zod output schema ────────────────────────────────────────────────────────

const RankedItemSchema = z.object({
  // coerce: handles string "5" from LLM instead of int 5
  employeeId:   z.coerce.number().int().catch(0),
  matchPct:     z.coerce.number().int().min(0).max(100).catch(50),
  // .catch('') converts non-strings; .transform fills empty/whitespace with a safe default
  whyRecommend: z.string().catch('').transform(s => s.trim() || 'No specific evidence cited.'),
  whyNot:       z.array(z.string()).catch(['No gap information provided.']),
  conflict:     z.boolean().catch(false),
  conflictNote: z.string().optional().catch(undefined),
});

export const LlmResponseSchema = z.array(RankedItemSchema);
export type RankedItem = z.infer<typeof RankedItemSchema>;

// ─── Service ──────────────────────────────────────────────────────────────────

// temperature=0 + fixed seed = greedy decoding, same input always produces same ranking
const LLM_SEED = Number(process.env.LLM_SEED ?? 42);

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

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

    // File: full prompt so you can inspect exactly what the LLM received
    writeSearchLog({ phase: 'llm-prompt', ircCode: irc.ircCode, promptLength: prompt.length, prompt });

    const text   = await this.callLlm(prompt);
    const result = await this.parseWithRetry(text, () => this.callLlm(prompt));

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
  const managerRequest =
    query?.trim() ||
    'Rank all candidates';

  const normalizedJd = jdText
    ? jdText
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, JD_TEXT_MAX_LENGTH)
    : '';

  const startDate =
    irc.project.startDate
      ?.toISOString()
      .slice(0, 10) ?? null;

  const roleContext = {
    roleTitle: irc.roleTitle,
    mandatorySkills: irc.mandatorySkills,
    preferredSkills:
      irc.preferredSkills ?? null,
    experienceRange:
      irc.experienceRange,
    location:
      irc.location,
    remotePolicy:
      irc.remotePolicy,
    projectStartDate:
      startDate,
  };

  const candidates =
    pool.map(candidate => ({
      employeeId:
        candidate.employeeId,

      skills:
        candidate.skills,

      experienceYears:
        candidate.experienceYears,

      currentAllocation:
        candidate.currentAllocation,

      availableDate:
        candidate.availableDate
          ?.toISOString()
          .slice(0, 10) ?? null,

      joiningNotice:
        candidate.joiningNotice,

      projectHistory:
        candidate.projectHistory,
    }));

  return `
You are TalentLens AI's candidate filtering and ranking engine.

Return ONE valid JSON array only.

MANAGER REQUEST
${JSON.stringify(managerRequest)}

ROLE CONTEXT
${JSON.stringify(roleContext)}

JOB DESCRIPTION
${JSON.stringify(normalizedJd || null)}

CANDIDATE POOL
${JSON.stringify(candidates)}

Follow this algorithm exactly.

STEP 1 — INTERPRET THE MANAGER REQUEST

The manager request has the highest priority.

Only requirements explicitly written in the manager request are hard filters.

Role context and job description are NOT hard filters unless the manager explicitly asks for those requirements.

Example:

Manager request:
"give me the Python candidate"

This means:
Return candidates matching Python.

It does NOT mean:
Python AND Kubernetes
Python AND AWS
Python AND payments
Python AND role mandatory skills.

Do not add requirements that the manager did not ask for.


STEP 2 — FILTER

For an explicit skill request such as Python, Java, React, AWS or Kubernetes:

A candidate qualifies only if:

- the exact skill appears in candidate.skills, case-insensitively;

OR

- projectHistory explicitly states hands-on use of that exact technology.

Do not infer a skill.

Do not infer Python from:
- backend work
- payments work
- APIs
- data engineering
- automation

Do not infer Kubernetes from:
- infrastructure
- DevOps
- AWS
- containers

If the manager asks:

"give me the Python candidate"

then candidate.skills containing "Python" is sufficient for eligibility.

The word "candidate" does NOT mean only one candidate.

Return ALL matching candidates unless the manager explicitly requests:
- top 1
- one candidate
- top 5
- another specific count.


STEP 3 — CREATE THE ELIGIBLE ID SET

Before producing the final response, silently determine the complete list of eligible employeeIds.

Important:

- Each employeeId may appear at most ONCE.
- Never score the same employee twice.
- Never produce different scores for the same employee.
- Once an employeeId has been added to the final output, it is USED and must never appear again.

For example, this is INVALID:

[
  {"employeeId":4,"matchPct":95},
  {"employeeId":4,"matchPct":85}
]

Each candidate must occur exactly once.


STEP 4 — RANK ONLY ELIGIBLE CANDIDATES

Rank eligible candidates primarily by real project-history evidence.

Ranking priority:

1. Direct project experience doing the requested work.
2. Strong adjacent project experience.
3. Relevant technical implementation evidence.
4. Skill tag with limited project evidence.
5. Weak project relevance.

Example: 
For understanding - 
  """
    For a simple skill request such as:

    "give me Python candidate"

    Python determines eligibility.

    Project history determines how strong the candidate ranks.

    Secondary role requirements may help distinguish otherwise similar candidates, but they must NEVER:

    - remove a Python candidate;
    - turn Kubernetes into a requirement;
    - cause you to claim that a candidate has Kubernetes;
    - cause you to claim any skill not present in the candidate record.
    """


STEP 5 — FACTUAL GROUNDING

Every statement must come from the SAME candidate's input record.

Never copy facts from one candidate to another.

Before writing whyRecommend, verify:

1. employeeId
2. skills
3. projectHistory

belong to the same candidate.

Never say:

"Has Python and Kubernetes"

unless BOTH are actually present in that candidate's supplied record or explicitly demonstrated by that candidate's projectHistory.

Never invent:
- skills
- technologies
- project experience
- location
- availability
- domain experience
- responsibilities


STEP 6 — SCORE

Use the full range.

90-100:
Direct project evidence of substantially the same work.

80-89:
Very strong adjacent project evidence.

70-79:
Solid relevant evidence with a meaningful gap.

55-69:
Useful overlap but incomplete project evidence.

40-54:
Mostly skill-level relevance.

20-39:
Weak project relevance.

0-19:
Very weak evidence.

Do not assign the same score to large groups of candidates without evidence.

Do not automatically give 95 because a candidate matches multiple skill words.


STEP 7 — WHY RECOMMEND

whyRecommend must be short.

Maximum 25 words.

Use factual evidence only.

Good:

"Python and FastAPI are recorded, with project evidence building settlement automation APIs."

Bad:

"Has Python and Kubernetes skills"

when Kubernetes is not actually supplied.


STEP 8 — WHY NOT

Return exactly ONE short whyNot item.

Maximum 18 words.

The gap must be factual.

Do not complain about a role-context skill unless it is materially relevant to ranking.

For a request asking only for Python candidates, do NOT repeatedly write:

"Missing Kubernetes"

for every candidate.

Prefer a meaningful project-evidence gap such as:

"No direct payments project evidence."

or:

"Python experience is QA-focused rather than backend implementation."


STEP 9 — AVAILABILITY

Do not treat "not available immediately" as a conflict unless immediate availability was explicitly requested.

Set conflict=true ONLY when:

- projectStartDate is known;
- candidate.availableDate is known;
- candidate.availableDate is later than projectStartDate.

Otherwise:

"conflict": false

When conflict=false, omit conflictNote.


STEP 10 — FINAL VALIDATION

Before returning the response, silently verify:

1. Every employeeId exists in candidatePool.
2. Every employeeId appears exactly ONCE.
3. No duplicate employeeIds exist.
4. No candidate failing the explicit manager filter is included.
5. Every qualifying candidate is included unless the manager requested a result limit.
6. No skill is claimed unless present in that candidate's own record.
7. Results are sorted once by matchPct descending.
8. Do not restart ranking from 95, then 85, then 75.
9. Do not generate multiple scoring passes.
10. Produce ONE final ranking only.


OUTPUT

Return:

[
  {
    "employeeId": 123,
    "matchPct": 78,
    "whyRecommend": "Short factual evidence.",
    "whyNot": [
      "One short factual gap."
    ],
    "conflict": false
  }
]

Return JSON only.
No markdown.
No explanation.
No duplicate employeeIds.
No second ranking pass.
The response must begin with [ and end with ].
`.trim();
}

  // ─── LLM API call (Ollama REST contract) ─────────────────────────────────
private async callLlm(prompt: string): Promise<string> {
  const configuredBaseUrl =
    this.config.get<string>('llmBaseUrl');

  const apiKey =
    this.config.get<string>('llmApiKey');

  const model =
    this.config.get<string>('llmModel') ??
    'qwen3.5:9b';

  if (!configuredBaseUrl) {
    throw new Error(
      'LLM_BASE_URL is not configured',
    );
  }

  const baseUrl =
    configuredBaseUrl.replace(/\/+$/, '');

    const rankingResponseSchema = {
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    properties: {
      employeeId: {
        type: 'integer',
      },
      matchPct: {
        type: 'integer',
        minimum: 0,
        maximum: 100,
      },
      whyRecommend: {
        type: 'string',
      },
      whyNot: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'string',
        },
      },
      conflict: {
        type: 'boolean',
      },
      conflictNote: {
        type: 'string',
      },
    },
    required: [
      'employeeId',
      'matchPct',
      'whyRecommend',
      'whyNot',
      'conflict',
    ],
  },
};

  const response = await fetch(
    `${baseUrl}/api/chat`,
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',

        ...(apiKey
          ? {
              Authorization: `Bearer ${apiKey}`,
            }
          : {}),
      },

      body: JSON.stringify({
        model,

        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],

        stream: false,

        /*
         * Valid for the native Ollama chat API.
         *
         * Keep false initially so thinking tokens do not consume a large
         * part of the generation budget. Filtering and ranking are still
         * performed by Qwen.
         */
        think: false,

        /*
         * Ask Ollama to constrain the response to valid JSON.
         *
         * This does not perform any application-side filtering.
         * Qwen still decides candidate eligibility and ranking.
         */
        format: rankingResponseSchema,

        options: {
          temperature: 0,
          seed: LLM_SEED,

          /*
           * Your prompt contains the instructions, IRC/JD context, and the
           * complete candidate pool. Ollama may otherwise allocate only 4K.
           */
          num_ctx: 16384,

          /*
           * Allow enough output for a large candidate JSON array.
           */
          num_predict: 4000,
        
        },
      }),
    },
  );

  if (!response.ok) {
    const responseBody =
      await response.text().catch(() => '');

    this.logger.error(
      `LLM API error: ${response.status} ${response.statusText}` +
      (responseBody
        ? ` | ${responseBody.slice(0, 1000)}`
        : ''),
    );

    throw new Error(
      `LLM API ${response.status}: ${response.statusText}`,
    );
  }

  const data = await response.json() as {
    model?: string;

    message?: {
      role?: string;
      content?: string;
      thinking?: string;
    };

    done?: boolean;
    done_reason?: string;

    prompt_eval_count?: number;
    eval_count?: number;

    total_duration?: number;
    prompt_eval_duration?: number;
    eval_duration?: number;
  };

  const content =
    data.message?.content?.trim() ?? '';

  /*
   * This log is critical for distinguishing these cases:
   *
   * 1. Qwen actually returned "[]"
   * 2. Qwen returned empty content
   * 3. The response was stopped by a token limit
   * 4. The prompt was evaluated with only a small context window
   */
  this.logger.log(
    `Ollama response | ` +
    `model=${data.model ?? model} | ` +
    `done=${String(data.done)} | ` +
    `doneReason=${data.done_reason ?? 'unknown'} | ` +
    `promptTokens=${data.prompt_eval_count ?? 'unknown'} | ` +
    `outputTokens=${data.eval_count ?? 'unknown'} | ` +
    `contentLength=${content.length} | ` +
    `contentPreview=${JSON.stringify(content.slice(0, 300))}`,
  );

  writeSearchLog({
    phase: 'llm-response',

    model:
      data.model ?? model,

    done:
      data.done ?? null,

    doneReason:
      data.done_reason ?? null,

    promptTokens:
      data.prompt_eval_count ?? null,

    outputTokens:
      data.eval_count ?? null,

    contentLength:
      content.length,

    thinkingLength:
      data.message?.thinking?.length ?? 0,

    content,
  });

  if (!content) {
    throw new Error(
      `LLM returned empty message.content; ` +
      `doneReason=${data.done_reason ?? 'unknown'}, ` +
      `promptTokens=${data.prompt_eval_count ?? 'unknown'}, ` +
      `outputTokens=${data.eval_count ?? 'unknown'}, ` +
      `thinkingLength=${data.message?.thinking?.length ?? 0}`,
    );
  }

  return content;
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
      this.logger.warn(`LLM response was not valid JSON — retrying. Raw output:\n${text}\nError: ${(e as Error).message}`);
      const retryText = await retry();
      parsed = this.extractJson(retryText); // throws if still bad — SearchService falls back
    }
    return LlmResponseSchema.parse(parsed);
  }

  // Extract + sanitise the JSON array from LLM output
  private extractJson(text: string): unknown {
    const sanitised = text
      .replace(/<think>[\s\S]*?<\/think>/gi, '') // strip Qwen3 thinking blocks if think:false is ignored
      .replace(/\/\/[^\n]*/g, '')                // strip JS // comments (invalid JSON)
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
