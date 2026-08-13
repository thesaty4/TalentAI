# Spec 14 — Pipeline Kanban Page

> Tell Copilot: **"implement spec 14"**
> Depends on: spec 13.
> Read `specs/business-rules.md` R12–R15b before starting.

---

## What this spec builds

`client/src/pages/pipeline/PipelinePage.tsx` — the Kanban board.

---

## Layout

Filter bar at the top → Kanban columns below → Rejected bucket at the bottom/side.

### Filter bar
- Project selector
- IRC multi-select (filtered to selected project)
- Stage multi-select (all PIPELINE_STAGES + Rejected)
- Role search (text input)

### Kanban columns

One column per stage in `PIPELINE_STAGES` order. Column header uses `STAGE_COLORS`. Each column shows a count badge.

Plus a **Rejected** section (collapsible list, not a full column — visually separate).

### Candidate card (per pipeline entry)

- `Avatar` + name + role title
- `StageChip` showing current stage
- IRC code + project name
- `matchPct` if set
- Action menu (⋮): **View profile**, **Advance stage**, **Revert stage**, **Schedule screening**, **Not a fit**

---

## Stage transitions

**Advance** (R12): `PATCH /pipeline/:id` with `{ stage: nextStage, direction: 'forward' }` → immediate update. Optimistic UI — move card, revert if API fails.

**Revert** (R13): Show a `<Modal />` confirmation — *"This will move [name] back to [prevStage]. This decision may already have been communicated. Continue?"*. Optional note input. On confirm: `PATCH /pipeline/:id` with `{ stage: prevStage, direction: 'backward', note }`.

**Not a fit** (R14): Show a `<Modal />` with reason selector (same chips as AI Search page) + free-text fallback. On confirm: `POST /pipeline/:id/not-fit`. Move card to Rejected section.

**Cannot advance from Allocated** (R15b): Advance action is hidden when `stage === 'Allocated'`.

---

## "Add to pipeline manually" button

Above the board: **+ Add candidate** button → opens a `<Modal />` with:
- Employee search (text input calling `GET /pool?search=...`)
- IRC selector (Open IRCs only — R2)
- On confirm: `POST /pipeline`

---

## API calls

```typescript
// lib/api/pipeline.api.ts
export const pipelineApi = {
  list:       (params) => apiClient.get('/pipeline', { params }).then(r => r.data),
  shortlist:  (dto)    => apiClient.post('/pipeline', dto).then(r => r.data),
  updateStage:(id, dto) => apiClient.patch(`/pipeline/${id}`, dto).then(r => r.data),
  notFit:     (id, dto) => apiClient.post(`/pipeline/${id}/not-fit`, dto).then(r => r.data),
};
```

---

## Acceptance criteria

- Board shows Satya (Manager Screening), Rohan (AI Shortlisted), Sara (AI Shortlisted) in the seeded columns.
- Advancing Rohan to Manager Screening succeeds; card moves column.
- Reverting Satya to AI Shortlisted shows confirmation modal; on confirm, card moves back.
- Marking Sara as "Not a fit" moves her to the Rejected section.
- Filter by `projectId=1` shows only IRC104521 + IRC104589 candidates.
- `<Spinner />` while loading; `<EmptyState />` when no results match filters.
