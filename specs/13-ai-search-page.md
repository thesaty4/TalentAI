# Spec 13 — AI Search Page

> Tell Copilot: **"implement spec 13"**
> Depends on: spec 12. This is the core feature — prioritise correctness.
> Read `specs/business-rules.md` R3–R11 before starting.

---

## What this spec builds

`client/src/pages/search/AISearchPage.tsx` — the full AI search experience.

---

## Layout: sticky composer + scrollable results

### Composer (sticky top bar)

1. **Project selector** — dropdown of manager's projects (pre-selected if `?projectId` in URL).
2. **IRC selector** — filtered to selected project's Open IRCs only (R2).
3. **Large textarea** — placeholder: *"Describe the talent requirement... e.g. Find engineers who've actually worked on similar payments integration projects."*
4. **JD upload** — small "Upload JD" button. On file select (PDF/DOCX only): call `POST /search/upload-jd` → on success show a removable chip with filename. Chip's × removes the JD text from state.
5. **Scope toggle** — two pills: **All** / **Applied** (default: All).
6. **Submit button** — orange arrow-right icon button. Disabled if no IRC selected.

### Staged loading sequence

While the API call is in flight, cycle through these status lines (state machine, 1.2s intervals):
```
Searching resource pool…
Analysing IRC & job description…
Matching project experience…
Ranking candidates…
```
Show as animated text below the composer. On response: fade out and show results.

### Empty state (before any search)

Centred illustration + text: *"Type a requirement, upload a JD, or select an IRC above to see AI-ranked matches."*

---

## Result cards (one per returned employee)

Use the `SearchResultDto` shape from spec 07.

**Card layout:**
- Top-left: `Avatar` (initials circle, coloured by businessUnit hash) + name + current role + meta row (location · allocation · notice period · BU).
- Top-right: large `matchPct` number + coloured horizontal bar + availability pill (green "Available now" if no conflict; amber "Conflict — see details" if `conflict: true`).
- **"Why we recommend {firstName}"** — `whyRecommend` text with a green `CheckCircle` icon. (R6 — must cite project evidence)
- **"Why not — what's missing"** — muted panel with bulleted `whyNot` list. (R7 — always present)
- If `conflict`: amber warning strip showing `conflictNote`. (R8)
- Skill chips from `skills[]`.
- If `isDuplicate`: yellow banner strip — *"Already in pipeline for [duplicateNote]"*. (R5)
- **Not-a-fit feedback row** — collapsed by default. Expands to show reason chips:
  `"Not enough domain exposure" | "Wrong location" | "Availability doesn't work" | "Level mismatch" | "Already staffed elsewhere"`
  Clicking a chip calls `POST /pipeline/:id/not-fit` (R16). After clicking, show a ✓ confirmation in the chip.
- **Action row**: **View profile** (`navigate('/employees/:id')`), **Shortlist** (disabled + "In pipeline" if `alreadyInPipeline: true` — R4), **Schedule screening**, **Not a fit**.

"Shortlist" → calls `POST /pipeline` → on success: update `alreadyInPipeline` in local state (optimistic update).

---

## API calls

```typescript
// lib/api/search.api.ts
export const searchApi = {
  rank: (dto: SearchDto) =>
    apiClient.post<SearchResultDto[]>('/search', dto).then(r => r.data),
  uploadJd: (ircId: number, scope: string, file: File, query?: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('ircId', String(ircId));
    form.append('scope', scope);
    if (query) form.append('query', query);
    return apiClient.post<{ jdText: string }>('/search/upload-jd', form).then(r => r.data);
  },
};
```

Use `useMutation` for search (not `useQuery` — it's triggered by user action, not page load).

---

## Acceptance criteria (matches the acceptance script)

1. Select "Payments Platform — Phase 2" → IRC104521.
2. Type *"Find engineers who've worked on payments integration"* → Submit.
3. Staged loading messages appear and cycle.
4. Results appear sorted by `matchPct` descending.
5. Satya Mishra's card shows `alreadyInPipeline: true` → Shortlist button disabled, says "In pipeline".
6. Satya's card shows amber conflict warning (available 2 Sep, role start conflict).
7. Devika Nair's card has a `whyNot` item mentioning lack of payments project history.
8. Tomás Silva's card has a `whyRecommend` citing the consumer payments mobile app despite the title mismatch.
9. Clicking a not-a-fit reason chip shows a ✓ confirmation.
10. On network error: `<ErrorBanner />` shown with "Search failed — try again" message.
