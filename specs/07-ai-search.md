# Spec 07 — AI Search Module

> Tell Copilot: **"implement spec 07"**
> Depends on: spec 06 (pipeline).
> Read `specs/business-rules.md` R3, R6–R11, R15 before starting.
> Also load `.github/instructions/talentlens-ai-search.instructions.md` — it governs every file in this module.

---

## What this spec builds

`server/src/search/` — three services (orchestration, LLM-based ranking, heuristic fallback) + controller + DTOs.
**No embedding pipeline.** The manager's query goes directly into the LLM prompt as the primary signal.

---

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/search` | manager, hr | AI-ranked candidate matches for an IRC |
| `POST` | `/search/upload-jd` | manager, hr | Upload PDF/DOCX → extract text → run search |

---

## `SearchDto` (`search.dto.ts`)

```typescript
ircId:   number    // @IsInt — must be an Open IRC (R2)
query?:  string    // @IsOptional @IsString — manager's free-text requirement (PRIMARY signal)
scope:   'all' | 'applied'  // @IsIn(['all','applied'])
jdText?: string    // @IsOptional @IsString — extracted JD text (SECONDARY context)
```

---

## `SearchResultDto` (shape returned per matched employee)

```typescript
employeeId:          number   // from model
fullName:            string   // re-hydrated from DB
roleTitle:           string   // re-hydrated from DB
location:            string   // re-hydrated from DB
businessUnit:        string   // re-hydrated from DB
experienceYears:     number   // re-hydrated from DB
skills:              string[] // re-hydrated from DB
currentAllocation:   string | null
availableDate:       string | null
matchPct:            number   // from model (0-100)
whyRecommend:        string   // from model — must cite project evidence (R6)
whyNot:              string[] // from model — always at least 1 item (R7)
conflict:            boolean  // from model
conflictNote:        string | null
isDuplicate:         boolean  // from DB check (R5)
duplicateNote:       string | null
alreadyInPipeline:   boolean  // from DB check (R4)
pipelineCandidateId: number | null
```

---

## Three services — responsibilities are fixed

### `search.service.ts` — orchestration only

1. Load IRC + parent project from Prisma. Throw `BadRequestException` if IRC is not `Open` (R2).
2. Build candidate pool:
   - `scope=applied`: employees in this IRC's active pipeline only (R10).
   - `scope=all`: pre-filter by mandatory-skill overlap; cap at `MAX_RANKING_CANDIDATES` (R15 excludes Rejected).
3. Call `LlmService.rank(irc, pool, query, jdText)`.
   - On any failure → call `HeuristicService.rank(irc, pool)` silently.
4. Re-hydrate every result from DB — ALL display fields replaced.
5. Duplicate-check (R5) and `alreadyInPipeline` check (R4).
6. Log to `search_logs`.
7. Return sorted by `matchPct` desc (R9).

### `llm.service.ts` — prompt + API + Zod only

1. Build `effectiveQuery` from query + optional jdText (see instructions for priority rules).
2. Construct the prompt with manager query **first**, IRC context **second** (see instructions).
3. `POST ${LLM_BASE_URL}/api/generate` with `{ model: "${LLM_MODEL}", prompt, stream: false, options: { temperature: 0 } }`.
4. Parse `response` field and validate with Zod schema.
5. Retry once on parse failure, then throw typed error.

Model is configured via `LLM_MODEL` environment variable and supports any Ollama-compatible LLM.

### `heuristic.service.ts` — synchronous fallback, no I/O

```
matchPct  = (matched mandatory / total mandatory) × 100, capped at 85
whyRecommend = "Matches {n} of {total} mandatory skills: {list}"
whyNot    = unmatched mandatory skills (at least 1 — R7)
conflict  = availableDate > project.startDate
```

---

## JD upload (`POST /search/upload-jd`)

- Accept `multipart/form-data` with field `file` (PDF or DOCX) and `ircId`, `scope`, optional `query`.
- PDF → `pdf-parse`, DOCX → `mammoth`. Throw `BadRequestException` for other types (R11).
- If extraction yields empty text: fall back to `query` alone, log warning (do not fail request).
- Pass extracted text as `jdText` into the same `SearchService.search()` flow.
- Multer: `memoryStorage()`, PDF/DOCX filter, `fileSize: 5MB`.

---

## Constants

```typescript
// server/src/common/constants/search.constants.ts
export const MAX_RANKING_CANDIDATES = 35;
export const JD_TEXT_MAX_LENGTH     = 4000;
```

Config must expose and validate:
- `LLM_BASE_URL`, `LLM_API_KEY` (optional), `LLM_MODEL`, `RANKING_PROVIDER`

---

## Acceptance criteria

- `POST /search { ircId:1, query:"engineers who worked on payments", scope:"all" }` → LLM-ranked array with `whyRecommend` citing project history.
- Satya Mishra appears with `alreadyInPipeline: true`.
- Invalid/missing Ollama config → heuristic fallback, no 500 error.
- Closed IRC → `400 Bad Request`.
- `POST /search/upload-jd` with PDF → extracted text used as secondary JD context.
- `scope:applied` returns only candidates already in this IRC's pipeline.
- Every search writes a `search_logs` row.

---

## Phase 2 — pgvector + RAG pre-filter

> Implement only after all Phase 1 acceptance criteria pass.
> Read the **pgvector + RAG rules** section in `.github/instructions/talentlens-ai-search.instructions.md` before starting.

### Goal

Replace the "full pool → LLM" path with "full pool → vector pre-filter → top-N → LLM".
The LLM only receives the `VECTOR_PRE_FILTER_LIMIT` most semantically relevant candidates instead of the entire employee table.

### New service — `search/embedding.service.ts`

Three public methods only. No business logic. No prompt building. No HTTP context.

```typescript
embedEmployee(employeeId: number): Promise<void>
// Builds profile text, calls Ollama /api/embed, writes vector to Employee.embedding

embedAll(): Promise<{ embedded: number; failed: number }>
// Bulk re-index all employees — for initial migration and periodic re-sync

findSimilar(queryText: string, limit: number): Promise<number[]>
// Returns employeeIds sorted by cosine similarity (closest first)
```

### Profile text construction

Concatenate in this exact order. Plain prose only — no JSON, no field labels.

```
{skills comma-separated}. {projectHistory descriptions period-separated}
```

Example:
```
Python, FastAPI, PostgreSQL, Redis. Built settlement automation service handling 2M daily transactions. Designed REST APIs for payment reconciliation platform.
```

### Prisma schema change (`schema.prisma`)

Add to `Employee` model:
```prisma
embedding Unsupported("vector(1536)")?  // pgvector — written by EmbeddingService only
```

### Migration SQL (new manual migration — do not rely on `prisma migrate dev` for raw SQL)

```sql
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS embedding vector(1536);
CREATE INDEX IF NOT EXISTS employee_embedding_ivfflat_idx
  ON "Employee" USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

### Updated `buildPool` flow (`search.service.ts`)

Step 2 gains a sub-step after base pool construction:

```
2a. Build base pool (scope + rejected exclusions — existing logic, unchanged)
2b. If EMBEDDING_PROVIDER is configured AND basePool.length > VECTOR_PRE_FILTER_LIMIT:
      queryText  = effectiveQuery(dto.query, dto.jdText)
      similarIds = await embeddingService.findSimilar(queryText, VECTOR_PRE_FILTER_LIMIT)
      filtered   = basePool filtered to similarIds (preserve similarity order)
      if filtered.length < MIN_VECTOR_RESULTS → use basePool (log WARN)
      else use filtered
2c. Otherwise use basePool unchanged
```

### New constants

```typescript
// server/src/common/constants/search.constants.ts
export const VECTOR_PRE_FILTER_LIMIT = 35;   // max candidates sent to LLM after vector pre-filter
export const EMBEDDING_DIMENSIONS    = 1536; // must match embedding model output; update if model changes
export const MIN_VECTOR_RESULTS      = 5;    // minimum intersection size before falling back to full pool
```

### New env vars (add to `configuration.ts` and `.env.example`)

```
EMBEDDING_PROVIDER=none                     # none | ollama — default: none (disables all vector paths)
EMBEDDING_BASE_URL=http://localhost:11434   # Ollama base URL (can be same as LLM_BASE_URL)
EMBEDDING_MODEL=nomic-embed-text            # any Ollama-compatible embedding model
```

`EMBEDDING_PROVIDER=none` (the default) disables all vector code paths. Phase 1 behaviour is fully preserved.

### Re-embedding triggers

`EmbeddingService.embedEmployee(id)` must be called (fire-and-forget with logged catch) whenever:
- An `EmployeeSkill` row is **created or deleted** for this employee.
- An `EmployeeProject` row is **created, updated, or deleted** for this employee.

Do NOT trigger on: `availableDate`, `currentAllocation`, `benchStatus`, `joiningNotice` — availability fields do not affect semantic similarity.

### New endpoint

```
POST /search/embed-all    roles: hr
```

Calls `EmbeddingService.embedAll()`. Returns `{ embedded: number; failed: number }`.
Not intended for repeated use — admin re-index operation only.

### New package

```
pgvector    # npm install pgvector
```

Use `pgvector.toSql(vector)` to serialize float arrays for `$queryRaw`. Never hand-serialize the float array.

### Acceptance criteria (Phase 2)

- `EMBEDDING_PROVIDER=none` → behaviour is bit-for-bit identical to Phase 1.
- `EMBEDDING_PROVIDER=ollama` + valid `EMBEDDING_MODEL` → `buildPool` returns ≤ `VECTOR_PRE_FILTER_LIMIT` candidates to LLM.
- `EmbeddingService` failure → silent fallback to full pool; search returns results, no 500.
- `POST /search/embed-all` → embeds all employees; returns `{ embedded, failed }`.
- After a skill update: `Employee.embedding` is updated before the next search request.
- Vector query uses `<=>` (cosine distance). Not `<->` (L2) or `<#>` (inner product).
