# Spec 08 — Candidate Module

> Tell Copilot: **"implement spec 08"**
> Depends on: spec 06 (pipeline), spec 04 (IRCs).
> Read `specs/business-rules.md` R2, R4, R14, R20 before starting.

---

## What this spec builds

`server/src/candidate/` — all endpoints that the Candidate role uses.

---

## Endpoints (all require `@Roles('candidate')`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/candidate/open-ircs` | List Open IRCs the candidate can apply to; marks already-applied ones |
| `POST` | `/candidate/apply/:ircId` | Apply to an Open IRC (creates pipeline entry at AI Shortlisted) |
| `GET` | `/candidate/my-pipeline` | All of the candidate's pipeline entries with stage + history |
| `GET` | `/candidate/feedback` | All feedback rounds across all the candidate's pipeline entries |
| `GET` | `/candidate/upcoming` | Scheduled/tentative interview rounds (feedbackRounds with a future roundDate) |

---

## Service rules

### `GET /candidate/open-ircs`
- Return all IRCs where `status = 'Open'`.
- For each, add `hasApplied: boolean` — true if this candidate already has a `PipelineCandidate` row for that IRC (regardless of stage, including Rejected).
- R20: scoped strictly to the logged-in candidate; no data from other candidates.

### `POST /candidate/apply/:ircId`
- Validate IRC is `Open` (R2) — throw `BadRequestException` if `Closed`.
- Check for existing `PipelineCandidate` (R4) — throw `ConflictException` if already applied.
- Create new `PipelineCandidate` at stage `AI Shortlisted`, `matchPct = null`, `whyRecommend = null`.
- `employeeId` comes from `req.user.employeeId` (set when candidate user is linked to an Employee row).
- Throw `BadRequestException` if the candidate user has no linked `employeeId`.

### `GET /candidate/my-pipeline`
- Return all `PipelineCandidate` rows where `employeeId = req.user.employeeId`.
- Include nested: IRC (ircCode, roleTitle, location), project name, stage, matchPct, whyRecommend, whyNot, conflict, conflictNote, appliedDate, updatedAt.
- Include a `stageHistory` array — for the demo, derive this from `feedbackRounds` ordered by date.

### `GET /candidate/feedback`
- All `FeedbackRound` rows across all the candidate's pipeline entries.
- Include: pipelineCandidate (IRC code, project name), roundName, interviewer, roundDate, rating, comments.
- R20: only the logged-in candidate's own rounds.

### `GET /candidate/upcoming`
- `FeedbackRound` rows where `roundDate >= today` across the candidate's pipeline entries.
- Include: roundName (used as interview title), roundDate, interviewer, `pipelineCandidate.irc.roleTitle`, `pipelineCandidate.irc.project.name`.
- Mode defaults to "Video call" for display (no mode field in DB — frontend shows static label).

---

## Acceptance criteria

- Satya Mishra calls `GET /candidate/open-ircs` → sees 5 IRCs; IRC104521 has `hasApplied: true`.
- `POST /candidate/apply/2` (IRC104589) → `201` + new pipeline entry.
- Applying to IRC104521 again → `409 ConflictException`.
- `GET /candidate/my-pipeline` → returns Satya's pipeline entry for IRC104521 at "Manager Screening" with feedback round included.
- `GET /candidate/feedback` → returns the seeded "Strong yes" manager screening round.
- `GET /candidate/upcoming` → empty (no future-dated rounds in seed; add one to test).
- Prince Verma (manager) calling `GET /candidate/open-ircs` → `403 Forbidden`.
