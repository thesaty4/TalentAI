# Spec 10 — Frontend Scaffold

> Tell Copilot: **"implement spec 10"**
> Depends on: spec 01–09 (all backend specs complete).
> Read `client/docs/architecture.md` and `specs/product-overview.md` before starting.

---

## What this spec builds

Vite + React + TypeScript project skeleton, Fortis design tokens, Tailwind config, shared API client, AuthContext, PrivateRoute, and the Shell layout (Sidebar + TopBar).

---

## Vite project init

`npm create vite@latest client -- --template react-ts` then install:
```
tailwindcss postcss autoprefixer
clsx tailwind-merge class-variance-authority
react-router-dom
@tanstack/react-query
axios
lucide-react
```

---

## `client/src/styles/tokens.css` — Fortis design tokens (exact values)

```css
:root {
  --color-network-blue:   #00263A;
  --color-pure-white:     #FFFFFF;
  --color-stacked-blue:   #003057;
  --color-celestial-blue: #4197CB;
  --color-power-orange:   #D64123;
  --color-secure-gray:    #414042;
  --color-commerce-green: #00945E;
  --color-energy-orange:  #FF6B00;
  --color-charge-yellow:  #FFCD00;
  --color-culture-gray:   #F6F6F6;
  --color-level-gray:     #D9D8D6;

  --bg-default:   var(--color-pure-white);
  --bg-muted:     var(--color-culture-gray);
  --bg-subtle:    var(--color-level-gray);
  --bg-inverse:   var(--color-network-blue);
  --bg-inverse-2: var(--color-stacked-blue);

  --fg-1: var(--color-network-blue);
  --fg-2: var(--color-secure-gray);
  --fg-3: #717071;
  --fg-on-dark-1: var(--color-pure-white);
  --fg-on-dark-2: #BFCBD5;
  --fg-link: var(--color-celestial-blue);
  --fg-link-hover: #33739A;

  --color-success: var(--color-commerce-green);
  --color-warning: var(--color-charge-yellow);
  --color-danger:  var(--color-power-orange);
  --color-info:    var(--color-celestial-blue);

  --border-subtle:  var(--color-level-gray);
  --border-default: #C5C7CA;
  --border-strong:  var(--color-secure-gray);
  --border-focus:   var(--color-celestial-blue);

  --font-display: "Bio Sans", "Inter", -apple-system, "Helvetica Neue", Arial, sans-serif;
  --font-body:    "Inter", "Bio Sans", -apple-system, "Helvetica Neue", Arial, sans-serif;

  --shadow-xs: 0 1px 2px rgba(0,38,58,0.06);
  --shadow-sm: 0 2px 4px rgba(0,38,58,0.06), 0 1px 2px rgba(0,38,58,0.04);
  --shadow-md: 0 6px 16px rgba(0,38,58,0.08), 0 2px 4px rgba(0,38,58,0.05);
  --shadow-focus: 0 0 0 3px rgba(65,151,203,0.35);
}
```

---

## `tailwind.config.ts` — mirror all tokens

Map every `--color-*` token into `theme.extend.colors`. Also add `fontFamily.display` and `fontFamily.body`. Add custom `boxShadow` entries mapping to `--shadow-*`.

---

## `client/src/lib/utils/cn.ts`

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
```

---

## `client/src/lib/api/client.ts`

Axios instance:
- `baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3001'`
- Request interceptor: attach `Authorization: Bearer <token>` from `localStorage.getItem('token')`.
- Response interceptor: on `401` → clear token + redirect to `/login`.

---

## `client/src/auth/AuthContext.tsx` + `useAuth.ts`

Context value:
```typescript
interface AuthContextValue {
  user: JwtUser | null;
  token: string | null;
  login: (token: string, user: JwtUser) => void;
  logout: () => void;
  isAuthenticated: boolean;
}
```
On mount: read token from `localStorage`, decode payload (client-side expiry check), set user. `login()` stores token + user to localStorage. `logout()` clears storage + redirects to `/login`.

---

## `client/src/auth/PrivateRoute.tsx`

If `!isAuthenticated` → `<Navigate to="/login" replace />`. Otherwise renders `<Outlet />`.

---

## `client/src/lib/constants/pipeline.constants.ts`

```typescript
export const PIPELINE_STAGES = ['AI Shortlisted','Manager Screening','Internal Tech Evaluation','Client Interview','Selected','Allocated'] as const;
export type PipelineStage = typeof PIPELINE_STAGES[number] | 'Rejected';

export const STAGE_COLORS: Record<string, string> = {
  'AI Shortlisted':           'bg-celestial-blue text-white',
  'Manager Screening':        'bg-[#D9A400] text-white',
  'Internal Tech Evaluation': 'bg-energy-orange text-white',
  'Client Interview':         'bg-stacked-blue text-white',
  'Selected':                 'bg-commerce-green text-white',
  'Allocated':                'bg-network-blue text-white',
  'Rejected':                 'bg-[#8A8C8E] text-white',
};
```

---

## Shell layout

**`Shell.tsx`** — renders `<Sidebar />` + main area (`<TopBar />` + `<Outlet />`). Sidebar is collapsible to icon-rail on desktop (>920px). Off-canvas drawer on mobile.

**`Sidebar.tsx`** — dark navy (`bg-network-blue`). Logo: orange rounded-square "T" badge + "TalentLens" wordmark (white). Nav links vary by role:

| Role | Links |
|------|-------|
| manager | Dashboard · AI Search · Pipeline · Resource Pool · IRC Applied |
| hr | Dashboard · AI Search · Pipeline · Resource Pool · IRC Applied |
| candidate | Dashboard · Open IRCs · My Pipeline · Feedback · Upcoming |

Active link accent: `--color-power-orange` left border + slightly lighter bg.

**`TopBar.tsx`** — page title (h2), notification bell (dot if unseenCount > 0), profile dropdown (name + role chip + Logout).

---

## Shared components to scaffold (stubs are fine — full implementation in later specs)

`Avatar`, `Badge`, `Button` (with `cva` variants), `Card`, `EmptyState`, `ErrorBanner`, `KpiCard`, `Modal`, `Pagination`, `Spinner`, `StageChip`, `Table`.

---

## `App.tsx` — route tree

```tsx
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route element={<PrivateRoute><Shell /></PrivateRoute>}>
    <Route path="/dashboard"    element={<RoleDashboard />} />
    <Route path="/search"       element={<AISearchPage />} />
    <Route path="/pipeline"     element={<PipelinePage />} />
    <Route path="/pool"         element={<ResourcePoolPage />} />
    <Route path="/irc-applied"  element={<IRCAppliedPage />} />
    <Route path="/projects"     element={<AllProjectsPage />} />
    <Route path="/employees/:id" element={<CandidateProfilePage />} />
    <Route path="/open-ircs"    element={<OpenIRCsPage />} />
    <Route path="/my-pipeline"  element={<MyPipelinePage />} />
    <Route path="/feedback"     element={<MyFeedbackPage />} />
    <Route path="/upcoming"     element={<UpcomingPage />} />
    <Route index element={<Navigate to="/dashboard" replace />} />
  </Route>
</Routes>
```

`RoleDashboard` renders `<ManagerDashboard />` or `<HRDashboard />` based on `user.role`.

---

## Acceptance criteria

- `npm run dev --prefix client` starts without errors.
- `/login` renders (even as a placeholder).
- Navigating to `/dashboard` without a token redirects to `/login`.
- After calling demo-login API and storing token, `/dashboard` renders the Shell with correct nav links for that role.
- `cn('px-4', true && 'text-white')` returns correct merged class string.
