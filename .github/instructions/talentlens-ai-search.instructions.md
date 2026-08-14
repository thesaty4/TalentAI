---
applyTo: "server/src/search/**"
description: "TalentLens AI search module rules. Three-service split: SearchService (orchestration + business rules), LlamaService (query-first Llama3 ranking + Zod validation), HeuristicService (synchronous skill-overlap fallback). Manager query is always the PRIMARY ranking signal; IRC JD provides refinement context only. Strict re-hydration rule — never trust model for display fields. Heuristic fallback on any Llama failure."
---

# TalentLens AI — Search Module Standards

Three services with **distinct, non-overlapping responsibilities**. Never merge them. Never add a fourth.

---

## Service responsibility boundaries

| File | Owns | Must NOT touch |
|------|------|----------------|
| `search.service.ts` | Orchestration + business rules: open-IRC enforcement, scope/rejected handling, pool pre-filter, Llama call, fallback control, re-hydration, duplicate checks, sorting, logging | Prompt building, model API calls, scoring algorithms |
| `llama.service.ts` | `effectiveQuery` composition, prompt construction, `/api/generate` call, Zod validation + one retry on parse failure | DB queries, business rules, HTTP context |
| `heuristic.service.ts` | Synchronous skill-overlap scoring + generic why/why-not text. No async, no I/O. | Llama calls, DB queries |

---

## Request flow (enforced in `search.service.ts`)

1. Load IRC + parent project from Prisma.
2. Build candidate pool — apply scope constraint (R10) and rejected-candidate exclusions (R15).
3. Pre-filter: keep employees with at least 1 mandatory-skill match; cap at `MAX_RANKING_CANDIDATES` by overlap count.
4. Call ranking:
   - If `RANKING_PROVIDER=heuristic` → skip Llama, use heuristic directly.
   - Otherwise call `LlamaService.rank(irc, pool, query, jdText)`.
   - On any Llama failure (network, parse, timeout) → silently fall back to `HeuristicService.rank()`.
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

// ❌ Never use display fields directly from the Llama response
```

---

## Llama prompt structure — query is FIRST (`llama.service.ts`)

The manager's query is the **primary ranking signal**. IRC JD fields are secondary context used only for refinement. This order must never be reversed.

```
SYSTEM:
  You are a staffing analyst. Rank candidates strictly by how well their real project
  history matches the manager's specific requirement. A candidate with direct, relevant
  project experience outranks one with more skills but no matching history.
  Return strict JSON per the schema — no extra text.

USER:
  ## What the manager needs [PRIMARY — match against this first]
  {effectiveQuery}

  ## Role context [SECONDARY — use for refinement only]
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
    whyNot (string[], at least 1 item — R7), conflict (bool), conflictNote (string, omit if no conflict) }
```

**LLM API contract:**
- `POST ${LLAMA_BASE_URL}/api/generate`
- Headers: `Authorization: Bearer ${LLAMA_API_KEY}` (only when key is set), `Content-Type: application/json`
- Body: `{ model: "${LLAMA_MODEL}", prompt: "<text>", stream: false }`
- Parse from response field `response`

---

## `effectiveQuery` construction (`llama.service.ts`)

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
export const LlamaResponseSchema = z.array(RankedItemSchema);
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

Validate all Llama env vars in `configuration.ts`:
- `LLAMA_BASE_URL` — required
- `LLAMA_API_KEY` — optional (omit header when not set)
- `LLAMA_MODEL` — required (e.g. `llama3`)
- `RANKING_PROVIDER` — `llama | heuristic` (default: `llama`)
