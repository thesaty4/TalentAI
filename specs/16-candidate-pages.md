# Spec 16 — Candidate-side Pages + Employee Profile

> Tell Copilot: **"implement spec 16"**
> Depends on: spec 15.
> Read `specs/business-rules.md` R2, R4, R20 before starting.

---

## What this spec builds

5 candidate pages + the shared `CandidateProfilePage`.

---

## Open IRCs page (`client/src/pages/candidate/OpenIRCsPage.tsx`)

List of all Open IRCs. Per IRC card:
- IRC code + role title + project name + customer
- Location + remote policy + experience range
- Mandatory skills chips + preferred skills chips
- Status pill: **Applied** (green, if `hasApplied: true`) or **Apply** button (orange)

**Apply** → `POST /candidate/apply/:ircId` → on success show "Applied" pill (R4 — subsequent clicks do nothing). On error show inline message.

---

## My Pipeline page (`client/src/pages/candidate/MyPipelinePage.tsx`)

For each of the candidate's pipeline entries (one card per IRC):

- IRC title + project name at the top
- **Horizontal stage stepper** showing: Shortlisted → Screening → Technical Evaluation → Client Interview → Selected. Active step highlighted with `--color-power-orange`. Rejected shows a red end-state.
- Timeline below the stepper: `FeedbackRound` rows ordered by date — each shows date, round name, interviewer, rating chip.
- **"What happens next"** note: a static string based on current stage:
  - `AI Shortlisted` → "Your profile is under review. A manager will reach out to schedule a screening."
  - `Manager Screening` → "Your manager screening is confirmed. Check Upcoming for the schedule."
  - `Internal Tech Evaluation` → "You're progressing to the technical evaluation stage."
  - etc.

---

## My Feedback page (`client/src/pages/candidate/MyFeedbackPage.tsx`)

List of all `FeedbackRound` rows across all the candidate's pipeline entries.

Per round card: round name, interviewer, date, rating chip (`Strong yes` = green, `Scheduled` = blue, `No` = red), comments text.

---

## Upcoming page (`client/src/pages/candidate/UpcomingPage.tsx`)

List of `FeedbackRound` rows where `roundDate >= today`.

Per card:
- Title (roundName)
- Date + time (format: "Wed, 20 Aug 2026 · 10:00 AM")
- Mode: "Video call" (static label — no mode field in DB)
- With whom: interviewer name
- IRC + project name

Empty state: *"No interviews scheduled yet. Check back after your profile moves to screening."*

---

## Candidate Profile page (`client/src/pages/employees/CandidateProfilePage.tsx`)

Route: `/employees/:id` — shared by managers/HR (from search results or pool) and candidates (their own profile).

Sections:
1. **Header**: Avatar (large), name, role title, BU, location, availability pill.
2. **Skills**: all skill chips.
3. **Career history** (`EmployeeProject[]`): card per project — project name, client, duration, description, domain tag chips.
4. **Ratings**: `EmployeeRating[]` — review cycle + rating pill.
5. **Allocation**: current allocation text + available date.

For managers/HR: shows `activeIrc` field if the employee is currently in a pipeline.
For candidates: shows only their own profile (R20).

---

## API calls

```typescript
// lib/api/candidate.api.ts
export const candidateApi = {
  openIrcs:    () => apiClient.get('/candidate/open-ircs').then(r => r.data),
  apply:       (ircId: number) => apiClient.post(`/candidate/apply/${ircId}`).then(r => r.data),
  myPipeline:  () => apiClient.get('/candidate/my-pipeline').then(r => r.data),
  feedback:    () => apiClient.get('/candidate/feedback').then(r => r.data),
  upcoming:    () => apiClient.get('/candidate/upcoming').then(r => r.data),
};

// lib/api/employees.api.ts
export const employeesApi = {
  get: (id: string) => apiClient.get(`/employees/${id}`).then(r => r.data),
};
```

---

## Acceptance criteria

- Satya Mishra (candidate) → Open IRCs shows IRC104521 as **Applied**.
- Satya → My Pipeline shows IRC104521 at "Manager Screening" stage with the seeded feedback round.
- Satya → My Feedback shows "Strong yes" from Prince Verma.
- Satya → Upcoming shows empty state (no future-dated rounds seeded).
- `/employees/EMP1042` shows Satya's full profile with project history.
- Satya cannot navigate to `/pool` → redirected away (R20).
