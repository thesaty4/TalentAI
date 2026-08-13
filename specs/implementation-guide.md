# TalentLens AI — Implementation Guide

> Hand this file to Copilot at the start of each session. Say: **"implement spec XX"** and Copilot will read the relevant spec file and implement that feature only, then stop for review.

---

## How to use this

1. Open VS Code in this workspace.
2. Open Copilot Chat in **Agent mode**.
3. Say: `implement spec 01` (or whichever number you're on).
4. Copilot reads the spec, implements the feature, stops.
5. Review the output, fix any issues, then move to the next spec.

Never skip a step — each spec depends on the previous one being in place.

---

## Backend specs (implement in order)

| # | Spec file | What gets built | Status |
|---|-----------|----------------|--------|
| 01 | [`specs/01-scaffold.md`](./01-scaffold.md) | NestJS project init, root `package.json`, `.env.example`, `nest-cli.json`, `tsconfig.json` | ⬜ |
| 02 | [`specs/02-database.md`](./02-database.md) | Prisma schema (all models) + `seed.ts` (~65 employees, 4 projects, 5 IRCs, pipeline entries) | ⬜ |
| 03 | [`specs/03-auth.md`](./03-auth.md) | Auth module: signup, login, demo-login, JWT strategy, guards | ⬜ |
| 04 | [`specs/04-projects-ircs.md`](./04-projects-ircs.md) | Projects + IRCs modules (read-only reference data, role-scoped) | ⬜ |
| 05 | [`specs/05-pool.md`](./05-pool.md) | Resource pool endpoint (paginated, filterable, sortable) + Employee profile | ⬜ |
| 06 | [`specs/06-pipeline.md`](./06-pipeline.md) | Pipeline module (stage moves, shortlist, not-fit, feedback rounds) | ⬜ |
| 07 | [`specs/07-ai-search.md`](./07-ai-search.md) | Search module: GeminiService + HeuristicService + SearchService + JD upload | ⬜ |
| 08 | [`specs/08-candidate.md`](./08-candidate.md) | Candidate-side endpoints (open IRCs, apply, my-pipeline, feedback, upcoming) | ⬜ |
| 09 | [`specs/09-notifications.md`](./09-notifications.md) | Notifications module | ⬜ |

---

## Frontend specs (implement after all backend specs are done)

| # | Spec file | What gets built | Status |
|---|-----------|----------------|--------|
| 10 | [`specs/10-frontend-scaffold.md`](./10-frontend-scaffold.md) | Vite + TS setup, `tokens.css`, Tailwind config, `cn()`, `apiClient`, `AuthContext`, `Shell` layout | ⬜ |
| 11 | [`specs/11-login-page.md`](./11-login-page.md) | Login/Signup page with demo-login buttons | ⬜ |
| 12 | [`specs/12-dashboards.md`](./12-dashboards.md) | Manager dashboard + HR dashboard (KPIs, funnel chart, projects list) | ⬜ |
| 13 | [`specs/13-ai-search-page.md`](./13-ai-search-page.md) | AI Search page — core feature (composer, staged loading, result cards, feedback chips) | ⬜ |
| 14 | [`specs/14-pipeline-page.md`](./14-pipeline-page.md) | Pipeline Kanban board (stage columns, advance/revert, not-fit dialog) | ⬜ |
| 15 | [`specs/15-pool-pages.md`](./15-pool-pages.md) | Resource Pool table + IRC Applied table | ⬜ |
| 16 | [`specs/16-candidate-pages.md`](./16-candidate-pages.md) | Open IRCs, My Pipeline stepper, My Feedback, Upcoming, Candidate Profile | ⬜ |

---

## Demo acceptance test (spec is done when this passes)

1. Click **"Login as Manager (demo)"**.
2. Go to **AI Search** → Payments Platform Phase 2 → IRC104521 → type *"Find engineers who've actually worked on similar payments integration projects"* → submit → get a real Gemini-ranked list with grounded why/why-not text.
3. Shortlist one candidate → appears in **Pipeline** → move them one stage forward.
4. Log out → **"Login as HR (demo)"** → see the same data org-wide.
5. Log out → **"Login as Candidate (demo)"** → see Satya Mishra's pipeline, feedback, upcoming interview.
