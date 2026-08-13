# Spec 15 — Resource Pool + IRC Applied Pages

> Tell Copilot: **"implement spec 15"**
> Depends on: spec 14.

---

## What this spec builds

`client/src/pages/pool/ResourcePoolPage.tsx` and `client/src/pages/irc-applied/IRCAppliedPage.tsx`.

---

## Resource Pool page

### Filter/search bar
- Text search (fullName, roleTitle)
- Location dropdown (unique values from pool)
- Business Unit dropdown
- Bench status toggle (All / Bench / Allocated)
- Experience range (min–max sliders or text inputs)
- Skills filter (multi-select tag input)

### Table

Columns: Avatar + Name, Role, BU, Location, Exp (yrs), Skills (first 3 chips + "+N more"), Status pill, Current IRC.

- Sortable columns: Name, Experience, Status.
- Pagination (20 per page).
- Row action menu (⋮): **View profile** → `/employees/:id`, **Add to pipeline** → opens modal with IRC selector.

### Export button

**Export CSV** — calls `GET /pool?export=csv&<current filters>` → triggers file download via `<a download>` trick.

---

## IRC Applied page

Table of all pipeline candidates across all IRCs the current user can see (manager = own projects, HR = all).

Columns: Candidate name + role, IRC code + role title, Project, Stage (`StageChip`), Applied date, Match %, Actions.

Filters: Project selector, Stage multi-select, IRC selector.

Sortable: Applied date, Match %, Stage.

Pagination.

---

## API calls

```typescript
// lib/api/pool.api.ts
export const poolApi = {
  list:   (params) => apiClient.get('/pool', { params }).then(r => r.data),
  export: (params) => apiClient.get('/pool', { params: { ...params, export: 'csv' }, responseType: 'blob' }).then(r => r.data),
};
```

---

## Acceptance criteria

- Resource Pool shows 65+ employees with pagination.
- Filter by `skills=Python,Kubernetes` returns only employees with both.
- Export CSV downloads a file with correct headers.
- IRC Applied shows Satya, Rohan, Sara against IRC104521 with their stages.
- `<EmptyState />` when no employees match filters.
