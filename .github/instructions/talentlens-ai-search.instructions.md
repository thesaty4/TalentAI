---
applyTo: "server/src/search/**"
description: "TalentLens AI search module rules. Apply only to files inside server/src/search/. Covers the four-service split (SearchService/RetrievalService/LlamaService/HeuristicService), provider-gated ranking, effectiveQuery + JD handling, strict output validation, re-hydration rule (never trust model for display fields), fallback behaviour, and search logging requirement."
---

# TalentLens AI — Search Module Standards

This module has **four services with distinct, non-overlapping responsibilities**. Never merge them.

---

## Service responsibility boundaries

| File | Owns | Must NOT touch |
|------|------|----------------|
| `search.service.ts` | Orchestration and business rules: open-IRC enforcement, scope/rejected handling, provider selection, fallback control, re-hydration, duplicate checks, sorting, logging | Prompt building, embedding calls, model parsing |
| `retrieval.service.ts` | Effective query composition, query embedding, hybrid retrieval SQL (hard filters + vector ordering) | Pipeline/business rule decisions, API response shaping |
| `llama.service.ts` | Llama prompt construction, `/api/generate` call, strict Zod validation + one retry on parse failure | DB queries, business rules, HTTP context |
| `heuristic.service.ts` | Synchronous skill-overlap scoring + generic why/why-not fallback output | Llama calls, DB queries, async I/O |

---

## Request flow (enforced in `search.service.ts`)

1. Load IRC + parent project from Prisma.
2. Build candidate pool with scope and rejected-candidate exclusions preserved.
3. Build `effectiveQuery` (manager query + JD text rules), then call retrieval for embedding + semantic evidence when query context exists.
4. Call ranking provider path:
  - if `RANKING_PROVIDER=heuristic`, skip Llama and use heuristic ranking.
  - otherwise call `LlamaService.rank()`; on any retrieval/ranking/parse error, fall back to `HeuristicService.rank()`.
5. **Re-hydrate**: replace ALL display fields from DB by `employeeId`. Trust model only for the fields below.
6. Duplicate-check: flag employees already active in a *different* open IRC.
7. Write `search_logs` row — every call, regardless of AI or heuristic path.
8. Return array sorted by `matchPct` descending.

---

## Fields trusted from the model (whitelist — nothing else)

```
matchPct · whyRecommend · whyNot · conflict · conflictNote
```

Always re-hydrate from DB: `fullName`, `roleTitle`, `skills`, `location`, `businessUnit`, `benchStatus`, `currentAllocation`, `availableDate`.

```typescript
// ✅ Re-hydrate after model returns
const employee = await this.prisma.employee.findUniqueOrThrow({ where: { id: item.employeeId }, include: { skills: true } });
return { ...item, fullName: employee.fullName, skills: employee.skills.map(s => s.name), /* … */ };

// ❌ Never use name/skills/location from the model response directly
```

---

## Effective query + JD handling (`retrieval.service.ts`)

- Supported upload types are PDF and DOCX only.
- Normalize extracted JD text: trim + collapse repeated whitespace/newlines.
- Apply safe max cap via named constant `JD_TEXT_MAX_LENGTH` (no magic number inline).
- Build `effectiveQuery` with this priority:
  - JD only: use JD text.
  - Query + JD: combine with labeled sections:
    - `Manager Query:`
    - `JD Text:`
  - Query only: use query.
  - Empty extraction: fall back to query and log warning (do not fail request).

## Llama prompt structure (`llama.service.ts`)

```
SYSTEM:
  You are an internal staffing analyst. Score candidates only on real, specific project
  evidence — not just skill tag overlap. A candidate with fewer skills but a directly relevant
  project should outscore one with more tags but no evidence. Return strict JSON per the schema.

USER:
  ## Open Requisition
  Role: {roleTitle} | Mandatory: {mandatorySkills} | Preferred: {preferredSkills}
  Experience: {experienceRange} | Location: {location} | Remote policy: {remotePolicy}
  Project: {projectName} (starts {startDate})

  ## Manager requirement
  {effectiveQuery context}

  ## Candidate pool
  [{employeeId, skills[], experienceYears, currentAllocation, availableDate,
    joiningNotice, projectHistory:[{projectName, duration, description}]}]
```

LLM API contract:

- `POST ${LLAMA_BASE_URL}/api/generate`
- Headers:
  - `Authorization: Bearer ${LLAMA_API_KEY}` (when key configured)
  - `Content-Type: application/json`
- Body: `{ model: ${LLAMA_MODEL}, prompt: <text>, stream: false }`
- Parse model output from response field `response`.

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

Throw a typed error if Zod validation fails after one retry — `search.service.ts` catches it and falls back to heuristic.

---

## Heuristic fallback (`heuristic.service.ts`)

Pure synchronous function — no async, no external calls, no DB.

```
score = (matched mandatory skills / total mandatory skills) × 100, capped at 85
whyRecommend = "Matches {n} of {total} mandatory skills: {list}"
whyNot = unmatched mandatory skills as array
conflict = availableDate > projectStartDate (simple date compare)
```
