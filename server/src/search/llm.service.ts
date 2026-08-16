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
  /*
   * IMPORTANT:
   * Use the raw manager query here.
   *
   * Do not call buildEffectiveQuery() because that method may combine
   * the manager query with the JD. The JD must never become part of
   * the primary hard-filter request.
   */
  const managerRequest = query?.trim() ?? '';

  const normalizedJd = jdText
    ? jdText
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, JD_TEXT_MAX_LENGTH)
    : '';

  const startDate =
    irc.project.startDate
      ?.toISOString()
      .slice(0, 10) ?? 'TBD';

  const roleContext = {
    roleTitle: irc.roleTitle,
    mandatorySkills: irc.mandatorySkills,
    preferredSkills: irc.preferredSkills ?? null,
    experienceRange: irc.experienceRange,
    location: irc.location,
    remotePolicy: irc.remotePolicy,
    projectStartDate: startDate,
  };

  const candidates = pool.map(candidate => ({
    employeeId: candidate.employeeId,
    skills: candidate.skills,
    experienceYears: candidate.experienceYears,
    currentAllocation: candidate.currentAllocation,
    availableDate:
      candidate.availableDate
        ?.toISOString()
        .slice(0, 10) ?? null,
    joiningNotice: candidate.joiningNotice,
    projectHistory: candidate.projectHistory,
  }));

  /*
   * Compact JSON keeps the prompt smaller for Qwen and leaves more
   * context/output tokens available for the ranking response.
   */
  const roleContextJson = JSON.stringify(roleContext);
  const candidatesJson = JSON.stringify(candidates);

  return `You are TalentLens AI's staffing analyst.

Return a valid raw JSON array only.
Do not output markdown.
Do not output analysis.
Do not output explanations before or after the JSON array.

You must perform two separate operations:

1. ELIGIBILITY: determine which candidates the manager explicitly requested.
2. RANKING: score and order the eligible candidates using project evidence.

Do not combine these two operations.


INPUT

managerRequest:
${JSON.stringify(
  managerRequest ||
    'No specific request was supplied; treat this as a broad candidate-list request.',
)}

roleContext:
${roleContextJson}

jobDescription:
${JSON.stringify(normalizedJd || 'N/A')}

candidateCount:
${candidates.length}

candidatePool:
${candidatesJson}


SOURCE PRIORITY

1. managerRequest controls eligibility and filtering.
2. candidatePool contains the only candidate facts you may use.
3. roleContext and jobDescription are secondary ranking context.

Never derive a hard eligibility filter from roleContext or jobDescription when the managerRequest contains an explicit requirement.

Never add the role mandatory skills to the manager's explicit filter.

Example:

managerRequest:
"give me Python candidate"

roleContext mandatory skills:
["Java", "Spring Boot", "Kafka"]

Correct eligibility:
All candidates whose skills contain Python.

Incorrect eligibility:
Candidates who have Python AND Java AND Spring Boot AND Kafka.


ELIGIBILITY PROCEDURE

Before scoring anyone, silently create a list named eligibleEmployeeIds.

Read managerRequest and decide whether it is:

A. BROAD
or
B. FILTERED


BROAD REQUEST

These are broad requests:

- "give me candidate list"
- "give me candidates"
- "show candidates"
- "rank candidates"
- "find the best candidates"
- "who is suitable"
- "recommend candidates"

For a broad request:

- every candidate in candidatePool is eligible;
- eligibleEmployeeIds must contain every supplied employeeId;
- return every supplied candidate;
- weak candidates should receive low scores rather than being excluded.


FILTERED REQUEST

A filtered request explicitly names one or more candidate requirements.

Examples:

- "give me Python candidate"
- "show Java candidates"
- "find React developers"
- "give me candidates with payments experience"
- "show candidates with 5+ years experience"
- "give me Python backend candidates"

For a filtered request:

- apply only requirements explicitly stated in managerRequest;
- do not add hidden requirements from roleContext;
- include every candidate satisfying the explicit request;
- exclude candidates clearly failing the explicit request.


NAMED-SKILL RULE

When managerRequest names a skill or technology, candidate.skills is authoritative for eligibility.

A candidate satisfies a named-skill filter when either:

1. candidate.skills contains that skill using a case-insensitive exact match;

OR

2. candidate.projectHistory explicitly states hands-on use of that exact skill.

An exact skill entry in candidate.skills is sufficient for eligibility.

Do not require project history to prove a skill that is already explicitly recorded in candidate.skills.

Project history affects ranking and matchPct after eligibility has been decided.

It does not remove an exact skill match.


PYTHON RULE

When managerRequest asks for a Python candidate or Python candidates:

1. Scan the skills array of every candidate.
2. Match "Python" case-insensitively.
3. Add every matching employeeId to eligibleEmployeeIds.
4. Include every candidate whose skills contain Python.
5. Exclude every candidate whose skills do not contain Python, unless projectHistory explicitly states hands-on Python use.
6. Do not require Python to appear in projectHistory when Python already appears in skills.
7. Do not require Java, Spring Boot, payments, location, or any other role requirement unless managerRequest explicitly asks for it.
8. Do not remove a Python candidate because their project is unrelated to the role.
9. Give an unrelated Python candidate a lower matchPct instead of excluding them.
10. If one or more candidates have Python in skills, the final result must contain candidates and must not be empty.


SINGULAR WORDING RULE

The phrase:

"give me Python candidate"

does not mean return only one person.

Treat "candidate" and "candidates" the same unless the manager explicitly says:

- one candidate
- only one candidate
- single best candidate
- top 1
- best one

Without an explicit result limit, return all matching candidates.


SKILL MATCHING

Use case-insensitive exact skill-name matching.

Allowed aliases:

- Node, NodeJS, and Node.js are equivalent.
- Go and Golang are equivalent.
- K8s and Kubernetes are equivalent.
- JavaScript and JS are equivalent.
- TypeScript and TS are equivalent.
- .NET and Dotnet are equivalent.

Do not invent other aliases.

Do not treat Java as JavaScript.
Do not treat React Native as React unless the manager's wording reasonably permits it.
Do not infer Python from generic backend work.
Do not infer Python from payments work.


SKILL FILTER EXAMPLE

Manager request:

"give me Python candidate"

Candidate 101:

skills:
["Python", "Django", "PostgreSQL"]

project:
"Built a pharmacy management API."

Eligibility:
INCLUDE.

The unrelated project may reduce the score, but Python is explicitly recorded.


Candidate 102:

skills:
["Java", "Spring Boot", "Kafka"]

project:
"Built a payment switching platform."

Eligibility:
EXCLUDE.

Strong payments experience does not prove Python.


Candidate 103:

skills:
["Python", "Selenium", "Pytest"]

project:
"Built automated regression tests."

Eligibility:
INCLUDE.

The candidate may rank below a Python backend engineer, but they satisfy the explicit Python filter.


DOMAIN-EXPERIENCE RULE

When managerRequest explicitly asks for experience rather than merely a skill, use projectHistory.

Example:

"give me candidates with payments experience"

Qualifying project evidence can include:

- payment processing
- payment gateway
- UPI
- IMPS
- NEFT
- RTGS
- authorization
- clearing
- settlement
- reconciliation
- payouts
- payment switching
- merchant payments
- card processing
- digital wallets
- cross-border payments
- transaction processing
- payment infrastructure

A skill tag alone is weaker than actual project evidence for an experience-based request.


MULTIPLE REQUIREMENTS

Apply AND only when managerRequest explicitly combines requirements.

Example:

"give me Python candidates with payments experience"

Eligibility requires:

- Python evidence
AND
- payments project evidence


Example:

"give me Python backend candidates"

Eligibility requires:

- Python evidence
AND
- backend implementation evidence


Do not add requirements that appear only in roleContext or jobDescription.


Apply OR only when managerRequest explicitly says "or".

Example:

"give me Python or Java candidates"

Eligibility requires:

- Python
OR
- Java


MISSING DATA RULE

Use only candidate fields provided in candidatePool.

Do not invent:

- candidate location
- role title
- business unit
- certifications
- education
- project technologies
- availability facts

If a requested attribute is absent from candidatePool, do not pretend every candidate fails it.

Evaluate only what the supplied candidate data supports.


RANKING PROCEDURE

After eligibleEmployeeIds has been created, rank only those candidates.

Use evidence in this order:

1. Direct project history doing substantially the same work.
2. Strong adjacent project history.
3. Relevant implementation experience.
4. Matching skill tags with limited supporting project evidence.
5. Weak role relevance despite satisfying the explicit manager filter.

A skill tag may make someone eligible.

A skill tag alone must not automatically produce a high score.


SCORING

matchPct must be an integer from 0 to 100.

90-100:
Direct and specific project evidence of substantially the same work.

80-89:
Very strong relevant or adjacent project experience with a modest gap.

70-79:
Solid relevant project evidence with an important gap.

55-69:
Meaningful overlap, but incomplete or adjacent evidence.

40-54:
The candidate satisfies the explicit skill request, but project evidence has limited alignment with the role.

20-39:
The candidate satisfies the explicit filter but has weak role and project alignment.

0-19:
The candidate technically satisfies the filter but has almost no relevant supporting evidence.

Use the full scoring range.

Do not give 90+ based only on skill tags.


WHY RECOMMEND

whyRecommend must:

- be exactly one sentence;
- cite factual candidate evidence;
- prefer projectHistory;
- mention recorded skills when relevant;
- never invent experience;
- never exaggerate evidence.

Example:

"Has Python and Django in the recorded skills and built backend APIs for a pharmacy management platform."


WHY NOT

whyNot must contain at least one short, genuine limitation or risk.

Every candidate must have at least one whyNot entry.

Valid examples:

- "No direct payments project history is documented."
- "Python is recorded, but the project history is QA-focused rather than backend implementation."
- "Strong backend experience, but no settlement or reconciliation work is documented."
- "Experience is below the role's requested range."
- "No production transaction volume is stated."

Never use:

- "None"
- "No gaps"
- "No concerns"
- "None identified"
- "N/A"


AVAILABILITY CONFLICT

Set conflict to true only when the supplied availability facts clearly show that the candidate cannot meet the project start date.

Use:

- currentAllocation
- availableDate
- joiningNotice
- roleContext.projectStartDate

When the candidate can meet the start date or the evidence is unclear:

"conflict": false

Omit conflictNote.

When the candidate clearly cannot meet the start date:

"conflict": true

Include one factual sentence in conflictNote.


MANDATORY FINAL VALIDATION

Before outputting JSON, silently perform these checks:

1. Re-read managerRequest only.
2. Determine broad or filtered.
3. If Python was requested, scan every candidate.skills array for Python.
4. Count the exact Python matches.
5. If the Python match count is greater than zero, the output must not be empty.
6. Include every exact Python match unless the manager requested a result limit or another explicit condition.
7. Do not exclude an exact Python match because of the role mandatory skills.
8. Do not exclude an exact Python match because projectHistory is unrelated.
9. Use unrelated projectHistory to lower the score, not to remove the candidate.
10. Do not return any employeeId outside candidatePool.
11. Do not return duplicate employeeIds.
12. Sort by matchPct descending.
13. Ensure every candidate has at least one whyNot item.
14. Omit conflictNote when conflict is false.


OUTPUT SHAPE

Return one JSON array.

Each candidate must use:

{
  "employeeId": 123,
  "matchPct": 75,
  "whyRecommend": "Exactly one factual sentence based on the supplied candidate record.",
  "whyNot": [
    "At least one genuine limitation or risk."
  ],
  "conflict": false
}

When conflict is true, also include:

"conflictNote": "Exactly one factual sentence explaining the availability conflict."


FINAL OUTPUT RULES

- Return valid JSON only.
- The first character must be [.
- The last character must be ].
- Do not return markdown.
- Do not use a code fence.
- Do not return analysis.
- Do not return headings.
- Do not return comments.
- Do not truncate the array.
- Do not use placeholder objects.
- Do not use ellipses.
- Do not invent employeeIds.
- Sort results by matchPct descending.

Return the JSON array now.`;
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
          num_ctx: 32768,

          /*
           * Allow enough output for a large candidate JSON array.
           */
          num_predict: 12000,
        
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
