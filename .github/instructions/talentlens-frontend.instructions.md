---
applyTo: "client/**"
description: "TalentLens AI frontend standards. Apply to all React/TypeScript client files — components, pages, hooks, API modules, constants, Tailwind config, styles. Covers SRP hook/component split, TanStack Query usage, three-state loading pattern, Tailwind utility-first rules, cn() helper, cva variants, and frontend folder placement."
---

# TalentLens AI — Frontend Standards

Stack: React 18 · TypeScript · Vite · Tailwind CSS · TanStack Query · React Router v6 · `lucide-react`

---

## SRP — hook fetches, component renders. Never combined.

```tsx
// ✅
export function usePipeline() {
  return useQuery({ queryKey: ['pipeline'], queryFn: () => pipelineApi.list() });
}
export function PipelinePage() {
  const { data, isPending, isError } = usePipeline();
  if (isPending) return <Spinner />;
  if (isError)   return <ErrorBanner />;
  return <KanbanBoard entries={data} />;
}
// ❌ Never useEffect + fetch inside a component for server state.
// ❌ Never call an API function directly inside JSX or a component body.
```

---

## Feature creation order

**types → api module → hook → component/page**

---

## Three states — always handle all three

```tsx
if (isPending) return <Spinner />;
if (isError)   return <ErrorBanner message={error.message} onRetry={refetch} />;
if (!data?.length) return <EmptyState title="No results" />;
// Then render happy path
```

Use TanStack Query (`useQuery` / `useMutation`) for **all** server state.

---

## Tailwind CSS rules

- Utility-first only. No separate CSS except `tokens.css` (CSS vars) and `index.css` (Tailwind directives + reset).
- All brand colors in `tailwind.config.ts` `theme.extend.colors` — no raw hex inline.
- `cn()` (clsx + tailwind-merge) for **all** conditional class names — never string concatenation.
- Component variants via constant maps or `cva` — never inline ternary chains.

```tsx
// ✅ constant map — lives in pipeline.constants.ts
const STAGE_COLORS: Record<PipelineStage, string> = {
  'AI Shortlisted':           'bg-celestial-blue text-white',
  'Manager Screening':        'bg-[#D9A400] text-white',
  'Internal Tech Evaluation': 'bg-energy-orange text-white',
  'Client Interview':         'bg-stacked-blue text-white',
  'Selected':                 'bg-commerce-green text-white',
  'Allocated':                'bg-network-blue text-white',
  'Rejected':                 'bg-[#8A8C8E] text-white',
};
// ❌ className={stage === 'Selected' ? 'bg-green-500' : stage === 'Rejected' ? ...}
```

---

## Folder placement

```
client/src/
├── styles/
│   ├── tokens.css          ← Fortis CSS custom properties (--color-*, --font-*, etc.)
│   └── index.css           ← @tailwind directives + 3-line global reset only
├── lib/
│   ├── api/
│   │   ├── client.ts       ← axios instance + JWT interceptor + 401 redirect
│   │   └── <domain>.api.ts ← one file per domain (auth, projects, search, pipeline…)
│   ├── constants/          ← pipeline.constants.ts, roles.constants.ts
│   └── utils/
│       ├── cn.ts            ← clsx + tailwind-merge
│       ├── formatters.ts
│       └── initials.ts
├── auth/                   ← AuthContext.tsx, useAuth.ts, PrivateRoute.tsx
├── components/             ← shared primitives only (Avatar, Badge, Button, Card,
│                              EmptyState, ErrorBanner, KpiCard, Modal, Pagination,
│                              Spinner, StageChip, Table)
├── layout/                 ← Shell.tsx, Sidebar.tsx, TopBar.tsx
└── pages/
    ├── auth/               ← LoginPage.tsx
    ├── dashboard/          ← ManagerDashboard.tsx  HRDashboard.tsx
    ├── search/             ← AISearchPage.tsx
    ├── pipeline/           ← PipelinePage.tsx
    ├── pool/               ← ResourcePoolPage.tsx
    ├── irc-applied/        ← IRCAppliedPage.tsx
    ├── projects/           ← AllProjectsPage.tsx
    ├── employees/          ← CandidateProfilePage.tsx
    └── candidate/          ← OpenIRCsPage  MyPipelinePage  MyFeedbackPage  UpcomingPage
```
