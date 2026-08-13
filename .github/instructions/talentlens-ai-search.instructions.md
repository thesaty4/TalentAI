---
applyTo: "server/src/search/**"
description: "TalentLens AI search module rules. Apply only to files inside server/src/search/. Covers the three-service split (SearchService/GeminiService/HeuristicService), what each service owns, Gemini prompt structure, Zod output validation schema, re-hydration rule (never trust model for display fields), fallback behaviour, and search logging requirement."
---

# TalentLens AI — Search Module Standards

This module has **three services with distinct, non-overlapping responsibilities**. Never merge them.

---

## Service responsibility boundaries

| File | Owns | Must NOT touch |
|------|------|----------------|
| `search.service.ts` | Orchestration: pre-filter → rank → re-hydrate → duplicate-check → log → return | Prompt building, Gemini SDK, scoring algorithm |
| `gemini.service.ts` | Prompt construction, Gemini API call, Zod validation of raw output | DB queries, business rules, HTTP context |
| `heuristic.service.ts` | Skill-overlap % scoring + generic why/why-not text generation | Gemini, DB queries, async I/O |

---

## Request flow (enforced in `search.service.ts`)

1. Load IRC + parent project from Prisma.
2. Pre-filter employee pool — mandatory-skill overlap; keep ≤ `MAX_GEMINI_CANDIDATES` (35).
3. Call `GeminiService.rank()`. On any error or timeout → call `HeuristicService.rank()` silently.
4. **Re-hydrate**: replace ALL display fields from DB by `employeeId`. Trust model only for the fields below.
5. Duplicate-check: flag employees already active in a *different* open IRC.
6. Write `search_logs` row — every call, regardless of AI or heuristic path.
7. Return array sorted by `matchPct` descending.

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

## Gemini prompt structure (`gemini.service.ts`)

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
  {query and/or jdText}

  ## Candidate pool
  [{employeeId, skills[], experienceYears, currentAllocation, availableDate,
    joiningNotice, projectHistory:[{projectName, duration, description}]}]
```

Use Gemini JSON response mode (`responseMimeType: 'application/json'`) + `responseSchema`.

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
export const GeminiResponseSchema = z.array(RankedItemSchema);
```

Throw a typed error if Zod validation fails — `search.service.ts` catches it and falls back to heuristic.

---

## Heuristic fallback (`heuristic.service.ts`)

Pure synchronous function — no async, no external calls, no DB.

```
score = (matched mandatory skills / total mandatory skills) × 100, capped at 85
whyRecommend = "Matches {n} of {total} mandatory skills: {list}"
whyNot = unmatched mandatory skills as array
conflict = availableDate > projectStartDate (simple date compare)
```
