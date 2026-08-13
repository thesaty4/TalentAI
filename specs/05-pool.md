# Spec 05 — Resource Pool + Employee Profile

> Tell Copilot: **"implement spec 05"**
> Depends on: spec 03 (auth).
> Read `specs/business-rules.md` R19, R20 before starting.

---

## What this spec builds

`server/src/pool/` (paginated resource pool list) and `server/src/employees/` (single employee profile).

---

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| `GET` | `/pool` | manager, hr | Paginated, filterable, sortable employee list |
| `GET` | `/employees/:id` | manager, hr, candidate* | Full employee profile |

*Candidate can view profiles reachable from their pipeline only — not arbitrary browsing. Enforce: if `role === candidate`, verify `employeeId === req.user.employeeId` or the profile is a public open-IRC listing. For the demo this is acceptable as an open read.

---

## `GET /pool` — query params

| Param | Type | Description |
|-------|------|-------------|
| `page` | number | default 1 |
| `limit` | number | default 20, max 100 |
| `search` | string | fullName or roleTitle contains |
| `location` | string | exact match |
| `businessUnit` | string | exact match |
| `benchStatus` | `Bench \| Allocated` | |
| `skills` | string (comma-separated) | employee must have ALL listed skills |
| `minExp` | number | experienceYears ≥ value |
| `maxExp` | number | experienceYears ≤ value |
| `sortBy` | `fullName \| experienceYears \| benchStatus` | default `fullName` |
| `sortOrder` | `asc \| desc` | default `asc` |

Response shape:
```json
{
  "data": [ /* Employee rows with skills[], current IRC code if any */ ],
  "meta": { "total": 65, "page": 1, "limit": 20, "pages": 4 }
}
```

Each row includes: `id`, `employeeCode`, `fullName`, `roleTitle`, `businessUnit`, `location`, `experienceYears`, `benchStatus`, `currentAllocation`, `availableDate`, `skills[]`, `activeIrcCode` (the IRC code if currently in an active pipeline, else null).

---

## `GET /employees/:id`

Full profile: all `Employee` fields + `skills[]` + `projectHistory[]` + `ratings[]` + current pipeline status (which IRCs they're active in, if any — for managers/HR only; candidates see their own).

---

## CSV export

`GET /pool?export=csv` — returns a CSV file (`Content-Disposition: attachment`). Same filters apply. Include columns: Employee Code, Name, Role, BU, Location, Exp (yrs), Status, Skills, Available Date.

---

## Acceptance criteria

- `GET /pool` returns paginated list with `meta`.
- `GET /pool?skills=Python,Kubernetes` returns only employees who have both skills.
- `GET /pool?export=csv` triggers a file download.
- `GET /employees/1` returns full profile including project history.
- Candidate cannot call `GET /pool` → `403` (R20 — candidates don't browse the full pool).
