# Product Overview & Flow — TalentLens AI

> Read this before implementing any feature. It defines what the product does, for whom, and why decisions were made.

---

## 1. Product overview

**What it is.** TalentLens AI is an internal staffing tool that lets delivery managers describe a talent need in plain English (or upload a job description) and get back an AI-ranked shortlist of internal employees — matched on *actual project evidence*, not just listed skills.

**Who it's for.**

| Role | Who | What they need |
|---|---|---|
| **Manager** | Delivery/project managers staffing their own open positions | Find the right internal person fast, understand *why* someone is or isn't a fit, avoid staffing conflicts |
| **HR / Resourcing** | Central resourcing/HR function | Org-wide visibility across all projects, requisitions, and the resource pool |
| **Candidate** | Any internal employee | See open roles, apply, track status, see interview feedback and upcoming schedules |

**Main goals.**
1. Cut time from "we need someone" to "we've shortlisted the right people" — rank on real project history, not keyword matching.
2. Make every recommendation **explainable** — specific reason they fit AND specific reason they might not (including availability conflicts).
3. Prevent duplicate-pipeline mistakes (same person in two active pipelines).
4. Give employees self-serve visibility into their own consideration status.
5. Give HR a single, org-wide demand vs. supply view.

**Non-goals for this build.** Demo/hackathon build on synthetic data only. Does not auto-retrain on feedback — it captures feedback correctly so that capability is credible and extensible later.

---

## 2. Product flow (end-to-end)

> IRC *creation* is out of scope — this flow starts from an already-open IRC.

### 2.1 High-level flow

```
Project (pre-existing, assigned to a Manager upstream)
   └── IRC (pre-existing, status: Open/Closed — read-only for this product)
         └── Manager/HR runs AI search scoped to one open IRC
               (free-text + optional JD upload, against full pool or applied-only)
               └── AI returns ranked, explained candidate list
                     └── Manager reviews why-recommend / why-not / conflicts
                           ├── Shortlist       → enters pipeline at "AI Shortlisted"
                           ├── Schedule screen → same + round logged
                           └── Not a fit       → dismissed for this IRC; reason persisted
                     └── Candidate progresses through stages (2.4)
                           ├── Selected → Allocated  (seat filled, terminal)
                           └── Rejected at any stage (requires reason)
```

**Project and IRC creation/closing are out of scope.** This product consumes them as reference data.

### 2.2 Alternate entry: candidate self-apply

A candidate discovers an Open IRC and applies directly — without a manager having searched first. This drops them into the same pipeline starting at "AI Shortlisted." A manager-sourced shortlist and a candidate-initiated application are the **same underlying pipeline record** — one record per (candidate, IRC) regardless of entry path.

### 2.3 The AI search step, precisely

1. User selects a **Project**, then an **IRC** under that project (always scoped to one open requisition).
2. User provides intent as free text, an uploaded JD (PDF/DOCX), or both.
3. User picks a **scope**: **All** (entire eligible pool) or **Applied** (only candidates already in this IRC's pipeline).
4. System returns a ranked list. Each result carries: match %, grounded "why recommend," honest "why not / gaps," skill tags, availability status, duplicate-pipeline banner (if applicable), scheduling-conflict warning (if applicable).
5. From a result the manager can: **View profile**, **Shortlist**, **Schedule screening**, **Not a fit**, or submit structured quick-feedback.

### 2.4 Pipeline stage sequence

```
AI Shortlisted → Manager Screening → Internal Tech Evaluation → Client Interview → Selected → Allocated
                                                                                                ↘ Rejected
```

- Stages are strictly ordered; advance one at a time.
- `Rejected` ("Not a fit") is reachable from **any** stage; always requires a reason.
- `Allocated` is terminal and successful.
- Backward (revert) transitions are allowed but require explicit confirmation + an optional note.

### 2.5 Candidate-side view (mirror of 2.4 — read-mostly)

- **Open IRCs** — what they can apply to.
- **My Pipeline** — stepper showing stage per application, timestamped update log, "what happens next."
- **Feedback** — every logged round with interviewer, date, rating, comments.
- **Upcoming** — scheduled or tentative interview rounds.

### 2.6 Notifications (state changes that must generate a notification)

- Candidate newly shortlisted.
- Screening scheduled.
- Duplicate pipeline detected.
- Candidate stage changes.

Notifications are scoped to the relevant user (owning manager, or HR for org-wide events).

---

## 4. Decisions log

| Question | Decision |
|---|---|
| Who can create/close a Project or IRC? | Out of scope — separate module. This product reads Projects/IRCs as reference data with a status flag. See R1–R3. |
| Can a manager see another manager's projects? | No — only their assigned projects (fixed seed data for this build; no in-app assignment feature). See R18. |
| Is "Not a fit" reversible? | The rejection is not edited. HR/Manager can re-add the candidate via a fresh pipeline entry starting at AI Shortlisted. Original rejection stays in history for audit. See R14–R15b. |
