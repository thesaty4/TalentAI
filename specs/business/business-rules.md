# Business Rules — TalentLens AI

> **Read before implementing any feature.** Every rule here is an engineering constraint, not just a UX note. Rules are prefixed R1–R22 — reference them in code comments or PR descriptions when a rule directly drives an implementation decision.

---

## R1–R3 · Requisition (IRC) scope and lifecycle

**R1. IRCs and Projects are read-only reference data.**
IRC and Project creation/closing are out of scope. This product only consumes a Projects table and an IRCs table (each IRC carries `status: Open | Closed` set upstream). Build the schema with the full IRC field set (project link, role title, mandatory skills, preferred skills, experience range, location, remote policy, opening date, status) and seed it. Do not build create/edit/close screens or endpoints.

**R2. Only `Open` IRCs are actionable.**
`Closed` IRCs remain visible in read views (history, all-projects list) but cannot be targeted by AI search, shortlist, or apply actions. Enforce this in the service layer, not just the UI.

**R3. IRC fields are real matching inputs.**
Mandatory skills, preferred skills, experience range, location, and remote policy are inputs to the AI ranking — not just display metadata. The search service must pass them to the active ranking provider and the heuristic fallback.

---

## R4–R5 · Uniqueness and duplicate handling

**R4. One active pipeline record per (employee, IRC).**
If a candidate is already in a pipeline for an IRC, the Shortlist action must be disabled and relabeled "In pipeline." Never create a second pipeline record for the same (employee, IRC) pair. Enforce with a unique constraint on the DB and a `ConflictException` in the service.

**R5. Cross-IRC duplicate must be flagged, not blocked.**
If a candidate returned by search is currently active in a *different* IRC's pipeline, show a duplicate banner naming that other project. This is a visibility rule — it does not block shortlisting. The manager decides.

---

## R6–R11 · Matching and explainability

**R6. Evidence-first scoring.**
A match score and its "why recommend" must cite the candidate's actual project history, not a skill tag overlap. A candidate with relevant skills but no matching project history must still appear (if in scope) but score lower, with a "why not" such as: *"skill tags only — no verified project exposure to this domain."*

**R7. Every result needs at least one "why not."**
Even a strong match must surface the most relevant residual gap. Never return a result with an empty `whyNot` array.

**R8. Scheduling conflict must be flagged with exact dates.**
If `availableDate` falls after the point the candidate needs to join the project, flag it with both dates and the gap size (e.g. *"becomes available 2 Sep, role needs joining by 1 Sep — 1-day gap"*). Warning only; the manager decides.

**R9. Results sorted by `matchPct` descending.** Always.

**R10. "Applied" scope is strictly bounded.**
`scope: applied` must only re-rank candidates already in that IRC's pipeline. It must never introduce a new candidate.

**R11. JD upload overrides or augments free-text.**
PDF and DOCX only. When provided, the extracted JD text is combined with (or takes precedence over) the typed query as the matching input.

---

## R12–R15b · Pipeline stage transitions

**R12. Forward transitions are immediate and require no confirmation.**
Advance one stage at a time following the fixed sequence: AI Shortlisted → Manager Screening → Internal Tech Evaluation → Client Interview → Selected → Allocated.

**R13. Backward (revert) transitions require explicit confirmation + optional note.**
They undo a communicated decision — the UX must present a confirmation dialog.

**R14. "Not a fit" → `Rejected` is reachable from any stage; always requires a reason.**
Reason is selected from a fixed list (insufficient domain exposure, location mismatch, availability, level mismatch, already staffed elsewhere) or free text. Rejection affects only this IRC's pipeline — the candidate's standing on all other IRCs is unaffected.

**R15. Rejected candidates are excluded from this IRC's AI search results.**
After `Rejected`, the candidate must not appear in either "All" or "Applied" scope searches for that IRC — unless explicitly re-added (R15a). Exclusion is IRC-scoped only.

**R15a. Re-adding a rejected candidate creates a fresh pipeline entry.**
HR or the owning Manager may re-add a rejected candidate. This creates a brand-new `PipelineCandidate` record starting at `AI Shortlisted`. The original `Rejected` record is preserved in history for audit — do not edit or delete it.

**R15b. `Allocated` is terminal.**
A candidate in `Allocated` for an IRC must not be movable back into earlier stages. Use the R15a re-add mechanism if the seat needs revisiting.

---

## R16–R17 · Feedback capture

**R16. "Not a fit" quick reasons must be persisted.**
Every reason a manager selects on a search result must be written to `not_fit_feedback` against the (candidate, IRC) pair. Capturing is a hard requirement. Automatic re-ranking is not required for this build.

**R17. Every interview/screening round must be logged and visible to the candidate.**
Log: interviewer, date, rating, comments. The candidate must be able to see this in their "My Feedback" view.

---

## R18–R20 · Role-based visibility

**R18. Manager sees only their assigned projects.**
A manager sees only the projects (IRCs, pipelines) they've been assigned to — fixed in seed data for this build. No in-app assignment feature is needed. Enforce in the service layer (`WHERE manager_id = req.user.id`).

**R19. HR sees everything.**
HR has org-wide visibility: all projects, all IRCs, all pipelines, the full resource pool.

**R20. Candidate sees only their own data.**
A candidate sees their own applications, pipeline status, feedback, and upcoming interviews only. Never another employee's pipeline, feedback, or contact details.

---

## R21–R22 · Data and environment

**R21. Synthetic data only.** No real employee or client data — per hackathon rules.

**R22. Demo login is convenience, not security.**
The "Login as (demo)" shortcut for each role is for judging/demo speed only. It is not production-grade auth and should not bypass any business-logic checks — it simply issues a real JWT for the seeded demo user.
