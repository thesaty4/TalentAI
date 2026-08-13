---
applyTo: "**"
description: "Universal TalentLens AI coding standards — apply to every file. SOLID checklist, naming conventions (files, variables, booleans, events, constants), size limits, no-magic-values rule, comment style, and hard stops that apply regardless of whether you're editing backend or frontend code."
---

# TalentLens AI — Universal Standards

## SOLID — pre-code checklist (run before every class, service, component, or hook)

- [ ] Does this class/component do exactly **one** job?
- [ ] New behaviour added without editing already-working code?
- [ ] Subclass fully honours the base contract?
- [ ] Interfaces narrow — no caller forced to depend on unused methods?
- [ ] Depending on abstraction, not concrete implementation?

If any answer is "no", redesign first.

---

## Naming conventions

| Type | Convention | Example |
|------|-----------|---------|
| NestJS module | `kebab-case.module.ts` | `pipeline.module.ts` |
| NestJS service | `kebab-case.service.ts` | `gemini.service.ts` |
| NestJS controller | `kebab-case.controller.ts` | `pipeline.controller.ts` |
| DTO | `kebab-case.dto.ts` | `update-stage.dto.ts` |
| React component | `PascalCase.tsx` | `StageChip.tsx` |
| React hook | `useXxx.ts` | `usePipeline.ts` |
| API module | `xxx.api.ts` | `pipeline.api.ts` |
| Types | `xxx.types.ts` | `pipeline.types.ts` |
| Constants | `xxx.constants.ts` | `pipeline.constants.ts` |

- Booleans: `is`, `has`, `can`, `should` prefix — `isLoading`, `hasConflict`
- Event handlers: `handle` prefix — `handleStageChange`, `handleSubmit`
- Collections: plural noun — `employees`, `stages`
- Module-level constants: `SCREAMING_SNAKE_CASE` — `MAX_GEMINI_CANDIDATES`

---

## Size limits

| Unit | Hard limit |
|------|-----------|
| Function / method body | 50 lines |
| React component (JSX) | 120 lines |
| Any file | 400 lines |

Split by responsibility when approaching limits.

---

## No magic values

```typescript
// ✅  server/src/common/constants/search.constants.ts
const MAX_GEMINI_CANDIDATES = 35;
// ❌  pool.slice(0, 35)
```

Constants: `server/src/common/constants/` · `client/src/lib/constants/`

---

## Comments: why, not what

```typescript
// ✅ Gemini context window caps at ~8k tokens; pre-filter keeps prompt tight
const pool = preFilter(employees, irc, MAX_GEMINI_CANDIDATES);
// ❌ Filter employees to max candidates
```

Never leave commented-out code.

---

## Specs — read before implementing any feature

Two files in `specs/` apply to every feature. Read both before writing code for any module:

- [`specs/product-overview.md`](../../specs/product-overview.md) — product context, end-to-end flow, pipeline stage sequence, candidate-side view, notifications triggers
- [`specs/business-rules.md`](../../specs/business-rules.md) — R1–R22, enforceable engineering constraints (IRC read-only, uniqueness, evidence-first scoring, stage transitions, feedback capture, role visibility)

Additional per-feature specs live in `specs/` (auth.md, pipeline.md, ai-search.md, etc.) — check for them before implementing the relevant module.

---

## Hard stops (apply everywhere)

- One module / one side per response. Stop and wait for review after each.
- Do not implement frontend and backend in the same response.
- Do not bundle unrelated features in one change.
- Do not add docstrings, extra error handling, or improvements to code not being changed.
- Do not leave `TODO` comments — implement it or note it in the review summary.
- Do not use `any` without a one-line comment explaining why.
- Do not refactor working code unless asked.
