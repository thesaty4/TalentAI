# Spec 12 — Dashboards (Manager + HR)

> Tell Copilot: **"implement spec 12"**
> Depends on: spec 11 (login).

---

## What this spec builds

`client/src/pages/dashboard/ManagerDashboard.tsx` and `HRDashboard.tsx`. Both use the same `DashboardLayout` — HR just has org-wide data scope.

---

## Manager Dashboard

### Greeting
`"Welcome back, {firstName}. Here's where your projects stand today."`

### 4 KPI cards (compute from real API data)
| Card | Value source |
|------|-------------|
| Open Requisitions | Count of manager's IRCs where `status = 'Open'` |
| Active Pipeline | Count of pipeline entries not in Rejected/Allocated for manager's IRCs |
| Awaiting Review | Count of pipeline entries at `AI Shortlisted` stage (needs manager action) |
| Positions Filled | Count of `Allocated` entries for manager's IRCs |

### Hiring funnel — horizontal bar chart
Candidate count per stage across all the manager's open IRCs. Use CSS/SVG bars (no chart library required). Stages and colors from `STAGE_COLORS` constant.

### Active projects list
Each project row:
- Name + customer
- Start date
- Open IRC count (chips showing IRC codes, colored by status)
- Pipeline candidate count
- Two buttons: **Search candidates** (`navigate('/search?projectId=X')`) and **View pipeline** (`navigate('/pipeline?projectId=X')`)

---

## HR Dashboard

Same sections as Manager Dashboard but:
- Greeting: `"Good morning, {firstName}. Here's the org-wide picture."`
- All KPIs are org-wide (all managers, all projects)
- Projects list shows all projects with manager name visible
- Extra section: **Resource pool utilization** — `Bench: X | Allocated: Y` count cards

---

## API calls

```typescript
// lib/api/projects.api.ts
export const projectsApi = {
  list: (params?: ProjectFilters) =>
    apiClient.get('/projects', { params }).then(r => r.data),
};

// lib/api/pipeline.api.ts
export const pipelineApi = {
  list: (params?: PipelineFilters) =>
    apiClient.get('/pipeline', { params }).then(r => r.data),
};
```

Use `useQuery` for both. Dashboard derives KPI counts from the fetched data client-side (no separate KPI endpoint needed).

---

## Acceptance criteria

- Manager dashboard shows only Prince Verma's 2 projects + their IRCs.
- HR dashboard shows all 4 projects.
- Clicking "Search candidates" on a project navigates to `/search?projectId=1`.
- KPI cards show real numbers (not hardcoded) that change when pipeline data changes.
- All three states handled: loading (`<Spinner />`), error (`<ErrorBanner />`), empty.
