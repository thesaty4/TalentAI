# Spec 04 — Projects + IRCs Modules

> Tell Copilot: **"implement spec 04"**
> Depends on: spec 03 (auth).
> Read `specs/business-rules.md` R1–R3, R18, R19 before starting.

---

## What this spec builds

`server/src/projects/` and `server/src/ircs/` — read-only reference data endpoints.

**R1 reminder:** Projects and IRCs are read-only. No create/edit/close endpoints. Seed data is ground truth.

---

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| `GET` | `/projects` | manager, hr | List projects. Manager: `WHERE managerId = req.user.id` (R18). HR: all (R19). |
| `GET` | `/projects/:id` | manager, hr | Single project with IRC list. |
| `GET` | `/projects/:id/ircs` | manager, hr | IRCs for a project. |
| `GET` | `/ircs/:id` | manager, hr | Single IRC detail (used by AI Search). |

---

## Query behaviour

**`GET /projects`** — supports optional query params:
- `status` — filter by `Active | On hold | Closed`
- `search` — name/customer contains (case-insensitive)

Response per project includes: `id`, `name`, `customer`, `status`, `startDate`, `tags`, `managerId`, plus nested `ircs[]` (id, ircCode, roleTitle, status only — no deep nesting).

**`GET /projects/:id/ircs`** — returns full IRC records for the project. Only accessible if the calling manager owns that project (R18) or the caller is HR (R19). Throw `ForbiddenException` otherwise.

---

## Service rules

- Manager scope is enforced in the service layer (`WHERE managerId = user.id`), not just the frontend.
- HR sees all — no filter by managerId.
- A `RolesGuard` with `@Roles('manager', 'hr')` blocks candidate access at the controller level.

---

## Acceptance criteria

- Prince Verma (manager) → `GET /projects` returns only Payments Platform Phase 2 and Claims Automation Revamp.
- Soumyadeep (HR) → `GET /projects` returns all 4 projects.
- Satya Mishra (candidate) → `GET /projects` returns `403 Forbidden`.
- `GET /projects/1/ircs` returns 2 IRCs (IRC104521, IRC104589).
- Swagger: `@ApiTags('projects')`, `@ApiTags('ircs')`, `@ApiBearerAuth()` on all endpoints.
