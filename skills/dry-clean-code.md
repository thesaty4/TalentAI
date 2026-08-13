# DRY & Clean Code — TalentLens AI Coding Standard

> Applies to: NestJS backend and React/TypeScript frontend.
> Read alongside `solid-principles.md` before any implementation.

---

## DRY Rules

### When to abstract

Abstract a pattern **only** when it appears ≥ 3 times in genuinely equivalent contexts and the abstraction does not force unrelated callers to share state.

```typescript
// ✅ Worth abstracting — same pagination logic used in 5+ list endpoints
function buildPaginationMeta(total: number, page: number, limit: number) {
  return { total, page, limit, pages: Math.ceil(total / limit) };
}

// ❌ Not worth abstracting — two usages with subtly different needs
//    creates more coupling than it removes
```

### When NOT to abstract

- One-off transformation used in a single place.
- Two patterns that *look* similar but serve different domain concepts.
- When the abstraction requires passing many flags/options to handle each caller's variation — that is the abstraction doing too much.

### Shared utilities location

- **Backend**: `server/src/common/utils/` — pure functions only, no NestJS dependencies.
- **Frontend**: `client/src/lib/utils/` — pure functions; no React dependencies.

---

## Naming Conventions

### Files

| Type | Convention | Example |
|------|-----------|---------|
| NestJS module file | `kebab-case.module.ts` | `pipeline.module.ts` |
| NestJS service | `kebab-case.service.ts` | `gemini-search.service.ts` |
| NestJS controller | `kebab-case.controller.ts` | `candidates.controller.ts` |
| DTO | `kebab-case.dto.ts` | `add-to-pipeline.dto.ts` |
| Prisma schema | `schema.prisma` | — |
| React component | `PascalCase.tsx` | `CandidateCard.tsx` |
| React hook | `camelCase.ts` | `useCandidate.ts` |
| API module | `camelCase.ts` | `candidatesApi.ts` |
| Type/interface file | `camelCase.types.ts` | `pipeline.types.ts` |
| Test file | mirrors source + `.spec` | `candidates.service.spec.ts` |

### Variables & functions

```typescript
// ✅ Clear intent
const activeIrcCount = ircs.filter(i => i.status === 'Open').length;
async function rankCandidatesByAi(irc: Irc, pool: Employee[]): Promise<RankedCandidate[]>

// ❌ Vague
const count = ircs.filter(i => i.status === 'Open').length;
async function process(x: Irc, y: Employee[])
```

- Boolean variables: `is`, `has`, `can`, `should` prefix — `isLoading`, `hasConflict`, `canShortlist`.
- Event handlers (React): `handle` prefix — `handleSubmit`, `handleStageChange`.
- Collections: plural noun — `employees`, `notifications`, `stages`.
- Constants: `SCREAMING_SNAKE_CASE` for true module-level constants.

### TypeScript: types vs. interfaces

- Use `interface` for objects that are extended or implemented.
- Use `type` for unions, intersections, mapped types, and aliases.
- Always prefer explicit types over `any`; use `unknown` when the type is genuinely unknown.

---

## Max Length Guidelines

| Unit | Soft limit | Hard limit |
|------|-----------|------------|
| Function / method body | 30 lines | 50 lines |
| React component (JSX) | 80 lines | 120 lines |
| File (all types) | 250 lines | 400 lines |

If a file exceeds the soft limit, split by responsibility before it exceeds the hard limit.

---

## Error Handling

### Backend (NestJS) — consistent shape

Every error response must match this shape:

```json
{
  "statusCode": 404,
  "message": "Employee not found",
  "error": "Not Found"
}
```

Use NestJS built-in exceptions; never use raw `throw new Error()` inside controllers or services:

```typescript
// ✅
throw new NotFoundException('Employee not found');
throw new BadRequestException('IRC must be Open to accept candidates');
throw new ConflictException('Candidate already in this pipeline');

// ❌
throw new Error('not found');
res.status(404).json({ msg: 'nope' });
```

A global exception filter (`GlobalExceptionFilter`) catches all unhandled exceptions and formats them consistently before the response is sent.

### Frontend — loading / error / empty state shape

Every data-fetching hook returns the same shape:

```typescript
interface QueryState<T> {
  data: T | undefined;
  isPending: boolean;
  isError: boolean;
  error: ApiError | null;
}
```

Use React Query's `useQuery` / `useMutation`; never raw `useEffect` + `useState` for server state.

Every list view must handle three states explicitly:
1. `isPending` → `<Spinner />`
2. `isError` → `<ErrorBanner message={error.message} />`
3. empty data → `<EmptyState … />`

---

## Comment Style

### Write a comment only when the code cannot explain itself

```typescript
// ✅ — explains *why*, not what
// Gemini limits context to ~8k tokens; pre-filter to top 35 candidates by skill overlap
const preFiltered = applyHeuristicFilter(pool, irc, 35);

// ❌ — restates the code
// Filter pool to 35 candidates
const preFiltered = applyHeuristicFilter(pool, irc, 35);
```

### Never leave dead code or commented-out code

If code needs to be removed, delete it. If it may return, put it in version control, not a comment.

---

## No Magic Values

```typescript
// ✅
const MAX_GEMINI_CANDIDATES = 35;
const PIPELINE_STAGES = ['AI Shortlisted', 'Manager Screening', /* … */] as const;

// ❌
const preFiltered = pool.slice(0, 35);  // where does 35 come from?
if (stage === 4) { /* … */ }            // what is stage 4?
```

All domain constants live in:
- **Backend**: `server/src/common/constants/`
- **Frontend**: `client/src/lib/constants/`
