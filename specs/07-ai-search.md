# Spec 07 — AI Search Module

> Tell Copilot: **"implement spec 07"**
> Depends on: spec 06 (pipeline).
> Read `specs/business-rules.md` R3, R6–R11, R15 AND `server/docs/architecture.md` § "AI Search Flow" before starting.
> Also load `.github/instructions/talentlens-ai-search.instructions.md` — it governs every file in this module.

---

## What this spec builds

`server/src/search/` — three services + controller + DTOs. This is the core feature.

---

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/search` | manager, hr | AI-ranked candidate matches for an IRC |
| `POST` | `/search/upload-jd` | manager, hr | Upload PDF/DOCX → extract text → run search |

---

## `SearchDto` (`search.dto.ts`)

```typescript
ircId:   number    // @IsInt — the open IRC to search against (R2: must be Open)
query?:  string    // @IsOptional @IsString — free-text from the manager
scope:   'all' | 'applied'  // @IsIn(['all','applied'])
jdText?: string    // @IsOptional @IsString — extracted JD text (set by upload-jd or caller)
```

---

## `SearchResultDto` (`search-result.dto.ts`)

```typescript
// One item per matched employee — returned as array
employeeId:    number
fullName:      string    // re-hydrated from DB (never from model)
roleTitle:     string    // re-hydrated from DB
location:      string    // re-hydrated from DB
businessUnit:  string    // re-hydrated from DB
skills:        string[]  // re-hydrated from DB
currentAllocation: string | null
availableDate: string | null
matchPct:      number    // from model
whyRecommend:  string    // from model
whyNot:        string[]  // from model
conflict:      boolean   // from model
conflictNote:  string | null  // from model
isDuplicate:   boolean   // from DB check
duplicateNote: string | null  // from DB check
alreadyInPipeline: boolean   // from DB check (R4 — disable Shortlist button on frontend)
```

---

## Three services — responsibilities are fixed

### `gemini.service.ts` — prompt + API + Zod only

1. Accept `(irc: Irc, pool: PoolCandidate[], query?: string, jdText?: string)`.
2. Build the prompt (see `server/docs/architecture.md` for structure).
3. Call Gemini with `responseMimeType: 'application/json'` and `responseSchema`.
4. Parse response text and validate with Zod schema:
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
5. Throw on Zod failure — `search.service.ts` catches and falls back.

### `heuristic.service.ts` — synchronous fallback, no I/O

```
score = (matched mandatory skills / total mandatory skills) × 100, capped at 85
whyRecommend = "Matches {n}/{total} mandatory skills: {list}"
whyNot = unmatched mandatory skills
conflict = availableDate exists && availableDate > projectStartDate
```

### `search.service.ts` — orchestration only

Step-by-step (see `server/docs/architecture.md` for detail):

1. Load IRC + parent project from Prisma (throw `NotFoundException` if IRC is `Closed` — R2).
2. If `scope === 'applied'`: load only employees in this IRC's pipeline (R10).
   If `scope === 'all'`: load full pool, pre-filter to ≤ `MAX_GEMINI_CANDIDATES` by mandatory-skill overlap.
3. Exclude employees with `stage = 'Rejected'` for this IRC (R15).
4. Call `GeminiService.rank()`. On any error → `HeuristicService.rank()`.
5. Re-hydrate: for each result, fetch full `Employee` from DB by `employeeId`. Replace all display fields. Keep only `matchPct`, `whyRecommend`, `whyNot`, `conflict`, `conflictNote` from the model.
6. Duplicate check: for each employee, query `pipeline_candidates` — if active in a DIFFERENT open IRC, set `isDuplicate = true`, `duplicateNote = "Active in [other IRC code] · [project name]"` (R5).
7. Check `alreadyInPipeline`: is this employee already in THIS IRC's pipeline? (R4 — frontend uses this to disable Shortlist button).
8. Log to `search_logs`.
9. Return sorted by `matchPct` descending (R9).

---

## JD upload (`POST /search/upload-jd`)

- Accept `multipart/form-data` with field `file` (PDF or DOCX) and `ircId`, `scope`, `query?`.
- Extract text server-side: PDF → `pdf-parse`, DOCX → `mammoth`. Throw `BadRequestException` for other file types (R11).
- Pass extracted text as `jdText` into the same `SearchService.search()` flow.
- Multer config: `memoryStorage()`, `fileFilter` for PDF/DOCX only, `limits.fileSize: 5MB`.

---

## Constants

```typescript
// server/src/common/constants/search.constants.ts
export const MAX_GEMINI_CANDIDATES = 35;
```

---

## Acceptance criteria

- `POST /search` with `{ ircId: 1, query: "Find engineers who've worked on payments", scope: "all" }` → returns a Gemini-ranked array with real `whyRecommend` citing project history.
- Satya Mishra appears with `alreadyInPipeline: true` (seeded in IRC104521 pipeline).
- If Gemini API key is wrong/missing → falls back to heuristic, returns array (no 500 error).
- `POST /search` with a Closed IRC → `400 Bad Request`.
- `POST /search/upload-jd` with a PDF → extracted text is used in ranking.
- `scope: applied` returns only the 3 seeded pipeline candidates, not the full pool.
- Every search writes a row to `search_logs`.
