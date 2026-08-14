# Spec 06 — Pipeline Module

> Tell Copilot: **"implement spec 06"**
> Depends on: spec 04 (projects/IRCs), spec 05 (pool).
> Read `specs/business-rules.md` R4, R5, R12–R17 before starting. Every rule here is an engineering constraint.

---

## What this spec builds

`server/src/pipeline/` — shortlisting, stage transitions, not-fit, feedback rounds, and the pipeline list endpoint.

---

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| `GET` | `/pipeline` | manager, hr | List pipeline candidates (filtered) |
| `POST` | `/pipeline` | manager, hr | Shortlist a candidate to an IRC |
| `PATCH` | `/pipeline/:id` | manager, hr | Move stage (forward or backward) |
| `POST` | `/pipeline/:id/not-fit` | manager, hr | Mark as Rejected with reason |
| `POST` | `/pipeline/:id/reactivate` | manager, hr | Re-add a rejected candidate (R15a) |
| `GET` | `/pipeline/:id/feedback` | manager, hr | List feedback rounds for a pipeline entry |
| `POST` | `/pipeline/:id/feedback` | manager, hr | Add a feedback round |

---

## Stage sequence (constant — do not hardcode inline)

```typescript
// server/src/common/constants/pipeline.constants.ts
export const PIPELINE_STAGES = [
  'AI Shortlisted',
  'Manager Screening',
  'Internal Tech Evaluation',
  'Client Interview',
  'Selected',
  'Allocated',
] as const;
export type PipelineStage = typeof PIPELINE_STAGES[number] | 'Rejected';
```

---

## Business rules to enforce

**R4 — unique (employee, IRC):**
`POST /pipeline` must check for existing active record. If found → `409 ConflictException('Candidate already in pipeline for this IRC')`.

**R12 — forward transitions are immediate:**
`PATCH /pipeline/:id` with `{ stage, direction: 'forward' }` — just update, no confirmation needed server-side.

**R13 — backward transitions require a note:**
`PATCH /pipeline/:id` with `{ stage, direction: 'backward', note? }` — note is optional but must be stored in `conflictNote`. The frontend shows a confirmation dialog; the server just validates `direction === 'backward'` and stores the note.

**R14 — "Not a fit" requires a reason:**
`POST /pipeline/:id/not-fit` body: `{ reason: string }`. Sets `stage = 'Rejected'`, writes `NotFitFeedback` row. `reason` is `@IsString @MinLength(3)`.

**R15 — rejected candidates excluded from search:**
The search service (spec 07) queries `pipeline_candidates` to exclude `stage = 'Rejected'` entries before building the ranking pool. This endpoint only sets the stage; the exclusion logic lives in the search service.

**R15a — re-activate creates a new record:**
`POST /pipeline/:id/reactivate` — the original rejected record stays (`stage = 'Rejected'`). Create a NEW `PipelineCandidate` row for the same (employeeId, ircId) starting at `AI Shortlisted`. (The `@@unique` constraint must be relaxed or a soft-delete approach used — use `isActive: Boolean @default(true)` flag and change unique constraint to `@@unique([employeeId, ircId, isActive])` where only active records are unique.)

**R15b — Allocated is terminal:**
Service must reject a forward transition from `Allocated` with `BadRequestException`.

---

## `GET /pipeline` — query params

| Param | Description |
|-------|-------------|
| `projectId` | filter by project |
| `ircId` | filter by IRC |
| `stage` | comma-separated stages |
| `role` | employee roleTitle contains |
| `page`, `limit` | pagination |

Returns pipeline entries with nested employee (name, role, location, skills[]), IRC (ircCode, roleTitle), and stage.

---

## Notifications (trigger on these events)

On `POST /pipeline` (shortlist) → create `Notification` for the owning manager: *"[Name] shortlisted for [IRC]"*.
On `PATCH /pipeline/:id` (stage change) → create `Notification` for the owning manager.
On `POST /pipeline/:id/not-fit` → create `Notification`.

Use a simple inline Prisma create — no event emitter needed for the demo.

---

## Acceptance criteria

- Shortlisting the same candidate twice → `409`.
- Moving Satya from "Manager Screening" → "Internal Tech Evaluation" succeeds.
- Moving backward without `direction: 'backward'` → rejected by validation.
- `POST /pipeline/:id/not-fit` with no reason → `400`.
- Reactivating a rejected candidate creates a new row; original `Rejected` row remains.
- `GET /pipeline?projectId=1&stage=AI Shortlisted,Manager Screening` returns filtered results with pagination.
