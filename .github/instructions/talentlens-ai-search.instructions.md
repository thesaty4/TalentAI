---
applyTo: "server/src/search/**"
description: "TalentLens AI search module rules. Three-service split (Phase 1): SearchService (orchestration + business rules), LlmService (query-first LLM ranking + Zod validation), HeuristicService (synchronous skill-overlap fallback). Phase 2 adds EmbeddingService (pgvector RAG pre-filter). Manager query is always the PRIMARY ranking signal; IRC JD provides refinement context only. Strict re-hydration rule — never trust model for display fields. Heuristic fallback on any LLM failure."
---

# TalentLens AI — Search Module Standards

Three services in Phase 1, four in Phase 2 — **distinct, non-overlapping responsibilities**. Never merge them.

---

## Service responsibility boundaries

| File | Owns | Must NOT touch |
|------|------|----------------|
| `search.service.ts` | Orchestration + business rules: open-IRC enforcement, scope/rejected handling, pool pre-filter, vector pre-filter call (Phase 2), LLM ranking call, fallback control, re-hydration, duplicate checks, sorting, logging | Prompt building, model API calls, scoring algorithms, embedding API |
| `llm.service.ts` | `effectiveQuery` composition, prompt construction, `/api/chat` call, Zod validation + one retry on parse failure | DB queries, business rules, HTTP context |
| `heuristic.service.ts` | Synchronous skill-overlap scoring + generic why/why-not text. No async, no I/O. | LLM calls, DB queries |
| `embedding.service.ts` *(Phase 2)* | Profile text construction, Ollama `/api/embed` call, DB write to `Employee.embedding`, `findSimilar` raw SQL query | Business rules, prompt building, model ranking |

---

## Request flow (enforced in `search.service.ts`)

1. Load IRC + parent project from Prisma.
2. Build candidate pool — apply scope constraint (R10) and rejected-candidate exclusions (R15).
3. Pre-filter: keep employees with at least 1 mandatory-skill match; cap at `MAX_RANKING_CANDIDATES` by overlap count.
3b. *(Phase 2)* If `EMBEDDING_PROVIDER` is set and pool exceeds `VECTOR_PRE_FILTER_LIMIT`: call `EmbeddingService.findSimilar(effectiveQuery, VECTOR_PRE_FILTER_LIMIT)`, intersect with pool. Fall through to full pool on any failure or thin intersection.
4. Call ranking:
   - If `RANKING_PROVIDER=heuristic` → skip LLM, use heuristic directly.
   - Otherwise call `LlmService.rank(irc, pool, query, jdText)`.
   - On any LLM failure (network, parse, timeout) → silently fall back to `HeuristicService.rank()`.
5. **Re-hydrate** every result from DB by `employeeId` — replace ALL display fields.
6. Duplicate-check: flag employees active in a *different* open IRC (R5).
7. Write `search_logs` row — every call, regardless of path.
8. Return sorted by `matchPct` descending (R9).

---

## Fields trusted from the model (whitelist — nothing else)

```
matchPct · whyRecommend · whyNot · conflict · conflictNote
```

Always re-hydrate from DB: `fullName`, `roleTitle`, `skills`, `location`, `businessUnit`,
`benchStatus`, `currentAllocation`, `availableDate`.

```typescript
// ✅ Correct
const emp = await prisma.employee.findUniqueOrThrow({ where: { id: item.employeeId } });
return { ...item, fullName: emp.fullName, skills: emp.skills.map(s => s.name) };

// ❌ Never use display fields directly from the LLM response
```

---

## LLM prompt structure — query is FIRST (`llm.service.ts`)

The manager's query is the **primary ranking signal**. IRC JD fields are secondary context used only for refinement. This order must never be reversed.

```
USER:
  ## What the manager is asking for [PRIMARY — apply this first]
  {effectiveQuery}

  ## Role context [SECONDARY — refine the ranking with this, don't override the above]
  Role: {roleTitle}
  Mandatory skills: {mandatorySkills}
  Preferred skills: {preferredSkills}
  Experience range: {experienceRange}
  Location: {location} | Remote: {remotePolicy}
  Project starts: {startDate}

  ## Candidate pool
  [{employeeId, experienceYears, skills[], currentAllocation, availableDate,
    joiningNotice, projectHistory:[{projectName, duration, description}]}]

  Return a JSON array. Each element:
  { employeeId (int), matchPct (0-100), whyRecommend (cite specific project evidence, ≥10 chars),
    whyNot (string[], at least 1 item), conflict (bool), conflictNote (string, omit if no conflict) }
  Include ALL candidates — score low fits honestly rather than excluding them.
```

**Ollama API contract:**
- `POST ${LLM_BASE_URL}/api/chat`
- Headers: `Authorization: Bearer ${LLM_API_KEY}` (only when key is set), `Content-Type: application/json`
- Body: `{ model: "${LLM_MODEL}", messages: [{role:"user", content: "<prompt>"}], stream: false, think: false, options: { temperature: 0 } }`
- Parse from response field `message.content`
- `think: false` is required — Qwen3 thinking models exhaust the token budget on chain-of-thought and leave the response empty without it
- Model configured via `LLM_MODEL` env var (e.g., `qwen3.5:9b`, `mistral`, etc.)

---

## `effectiveQuery` construction (`llm.service.ts`)

Build `effectiveQuery` before inserting into the prompt:

| Input available | `effectiveQuery` value |
|-----------------|------------------------|
| Query only | Use query as-is |
| JD only | Use JD text (capped at `JD_TEXT_MAX_LENGTH`) |
| Query + JD | `Manager requirement: {query}\n\nJob description:\n{jd_capped}` |
| Neither | Empty string — prompt runs with role context only |

Normalize JD text: trim + collapse repeated whitespace/newlines before capping.
Apply `JD_TEXT_MAX_LENGTH` cap via the named constant — never inline the number.

---

## Zod output validation schema

```typescript
const RankedItemSchema = z.object({
  employeeId:   z.number().int(),
  matchPct:     z.number().int().min(0).max(100),
  whyRecommend: z.string().min(10),
  whyNot:       z.array(z.string()),
  conflict:     z.boolean(),
  conflictNote: z.string().optional(),
});
export const LlmResponseSchema = z.array(RankedItemSchema);
```

Retry once on Zod failure. Throw typed error on second failure — `search.service.ts` catches and falls back.

---

## Heuristic fallback (`heuristic.service.ts`)

Pure synchronous function — no async, no external calls, no DB access.

```
matchPct  = (matched mandatory / total mandatory) × 100, capped at 85
whyRecommend = "Matches {n} of {total} mandatory skills: {list}"
whyNot    = unmatched mandatory skills (at least 1 — R7)
conflict  = availableDate exists AND availableDate > project.startDate
```

---

## Environment config

Validate all Ollama env vars in `configuration.ts`:
- `LLM_BASE_URL` — required (default: `http://localhost:11434`)
- `LLM_API_KEY` — optional (omit header when not set)
- `LLM_MODEL` — required (default: `qwen3.5:9b`; supports any Ollama-compatible model)
- `RANKING_PROVIDER` — `llm | heuristic` (default: `llm`)
- `EMBEDDING_PROVIDER` — `none | ollama` (default: `none` — disables all vector paths)
- `EMBEDDING_BASE_URL` — required when `EMBEDDING_PROVIDER=ollama` (default: `http://localhost:11434`)
- `EMBEDDING_MODEL` — required when `EMBEDDING_PROVIDER=ollama` (e.g. `nomic-embed-text`)

---

## pgvector + RAG rules (Phase 2)

### Ownership

- `embedding.service.ts` is the **only** file that writes to `Employee.embedding`.
- `search.service.ts` calls `embeddingService.findSimilar()` — never calls the embedding API directly.
- `llm.service.ts` receives the pre-filtered pool — it must NOT know whether vector pre-filter was applied.
- `heuristic.service.ts` is unchanged — it receives whatever pool `search.service.ts` provides.

### Vector pre-filter placement

The vector pre-filter sits between `buildPool()` and `llm.rank()`. Business rules (scope, rejected exclusions) always run first:

```
buildPool() [scope + rejected logic] → vector pre-filter → llm.rank()
```

Never apply vector pre-filter before the scope/rejected exclusion step.

### Embedding API contract (Ollama)

```
POST ${EMBEDDING_BASE_URL}/api/embed
Body:     { "model": "${EMBEDDING_MODEL}", "input": "<profile text>" }
Response: { "embeddings": [[...floats]] }
```

Access the vector at `response.embeddings[0]`. Never use `/api/generate` or `/api/chat` for embeddings.

### Raw SQL rule (`findSimilar`)

Prisma does not support pgvector operators natively. Use `prisma.$queryRaw` with the `pgvector` package:

```typescript
import pgvector from 'pgvector';

const rows = await this.prisma.$queryRaw<{ id: number }[]>`
  SELECT id FROM "Employee"
  WHERE embedding IS NOT NULL
  ORDER BY embedding <=> ${pgvector.toSql(queryVector)}::vector
  LIMIT ${limit}
`;
```

Never hand-serialize the float array. Always use `pgvector.toSql()`.

### Fallback chain (all failures must be silent)

| Condition | Action |
|-----------|--------|
| `EMBEDDING_PROVIDER=none` or unset | Skip vector path entirely; use full pool |
| `findSimilar()` throws | Log WARN; continue with full pool |
| Intersection with base pool < `MIN_VECTOR_RESULTS` | Log WARN; continue with full pool |

Never surface a vector failure to the HTTP client. The search must always return results.

### Profile text rule

Plain prose only. No JSON. No field labels. Embedding models are trained on prose.

```typescript
// ✅ correct
const text = `${skills.join(', ')}. ${descriptions.join('. ')}`;

// ❌ wrong — structured keys reduce embedding quality
const text = JSON.stringify({ skills, projectHistory });
```

### Re-embed rule

Call `embeddingService.embedEmployee(id)` (fire-and-forget, logged catch) when:
- An `EmployeeSkill` row is created or deleted.
- An `EmployeeProject` row is created, updated, or deleted.

Never await re-embedding in the HTTP response path. Never trigger on availability field changes.

### Constants rule

`VECTOR_PRE_FILTER_LIMIT`, `EMBEDDING_DIMENSIONS`, and `MIN_VECTOR_RESULTS` must always be imported from `search.constants.ts`. Never inline these numbers.

### Index rule

The IVFFlat index is created in the migration SQL only. Never create or drop it in application code.
