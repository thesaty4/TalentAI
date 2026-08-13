# Frontend Architecture — TalentLens AI Client

> Read alongside `/skills/solid-principles.md`, `/skills/dry-clean-code.md`, and `/skills/folder-structure.md` before any implementation.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | React 18 + TypeScript (strict) |
| Build tool | Vite |
| Routing | React Router v6 (data router) |
| Server state | TanStack Query (React Query v5) |
| Client state | React Context (auth only) — no Redux |
| Styling | Tailwind CSS v3 |
| Icons | `lucide-react` |
| HTTP client | Axios (one shared instance) |
| Forms | React Hook Form + Zod (client-side validation) |
| Testing | Jest + React Testing Library |

---

## MVC-Style Layering (mapped to frontend)

```
View         →  components/ + pages/        render only; no data-fetching logic
Controller   →  hooks (useXxx.ts)           orchestrate: call API, transform, return state
Model        →  lib/api/ + AuthContext      data access; no UI concerns
```

### Data flow

```
User action
  → Page / Component calls hook
    → Hook calls API function (lib/api/xxx.api.ts)
      → Axios instance (lib/api/client.ts) sends request
        → TanStack Query caches response
          → Hook returns { data, isPending, isError } to component
            → Component renders
```

No component ever imports `axios` directly. No component ever calls `fetch`. All server interaction goes through the `lib/api/` layer.

---

## API Integration Pattern

### Shared Axios client (`lib/api/client.ts`)

```typescript
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3001',
});

// Attach JWT from localStorage on every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to /login on 401
apiClient.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) window.location.href = '/login';
    return Promise.reject(err);
  }
);
```

### Per-feature API modules (`lib/api/xxx.api.ts`)

Each file exports a plain object with typed async functions:

```typescript
// lib/api/search.api.ts
export const searchApi = {
  rank: (dto: SearchDto) =>
    apiClient.post<RankedCandidate[]>('/search', dto).then(r => r.data),
  uploadJd: (ircId: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    form.append('ircId', String(ircId));
    return apiClient.post<{ jdText: string }>('/search/upload-jd', form).then(r => r.data);
  },
};
```

### Hooks consume API modules via TanStack Query

```typescript
// pages/search/useSearch.ts
export function useSearchMutation() {
  return useMutation({ mutationFn: searchApi.rank });
}
```

---

## Error / Loading / Empty State Conventions

Every list page must render exactly these three states. Use the shared components:

```tsx
if (isPending) return <Spinner />;
if (isError)   return <ErrorBanner message={error.message} onRetry={refetch} />;
if (!data?.length) return <EmptyState title="No results" description="…" />;
```

Never show a blank screen. Never swallow errors silently.

### API error shape (from backend)

```typescript
interface ApiError {
  statusCode: number;
  message: string;
  error: string;
}
```

The Axios response interceptor normalises network errors to this shape before they bubble up.

---

## Auth Context (`auth/AuthContext.tsx`)

```typescript
interface AuthContextValue {
  user: JwtUser | null;      // null = unauthenticated
  token: string | null;
  login: (token: string, user: JwtUser) => void;
  logout: () => void;
  isAuthenticated: boolean;
}
```

Token stored in `localStorage`. On app boot, `AuthContext` reads the stored token and validates it (check expiry client-side; re-validate on 401).

`PrivateRoute` wraps protected routes — redirects to `/login` if `!isAuthenticated`.

---

## Routing Structure (`App.tsx`)

```tsx
<Routes>
  <Route path="/login" element={<LoginPage />} />

  <Route element={<PrivateRoute><Shell /></PrivateRoute>}>
    {/* Manager + HR */}
    <Route path="/dashboard"  element={<RoleDashboard />} />
    <Route path="/search"     element={<AISearchPage />} />
    <Route path="/pipeline"   element={<PipelinePage />} />
    <Route path="/pool"       element={<ResourcePoolPage />} />
    <Route path="/irc-applied" element={<IRCAppliedPage />} />
    <Route path="/projects"   element={<AllProjectsPage />} />
    <Route path="/employees/:id" element={<CandidateProfilePage />} />

    {/* Candidate only */}
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

## Tailwind CSS Conventions

### Utility-first only

No separate CSS files except `styles/tokens.css` (CSS variables) and `styles/index.css` (Tailwind directives + 3-line global reset).

### Theme config

All brand colors, spacing, and font names are in `tailwind.config.ts` under `theme.extend`. No raw hex values inline in JSX.

```ts
// tailwind.config.ts
theme: {
  extend: {
    colors: {
      'network-blue':  '#00263A',
      'stacked-blue':  '#003057',
      'celestial-blue':'#4197CB',
      'power-orange':  '#D64123',
      // … all tokens from design spec
    },
    fontFamily: {
      display: ['"Bio Sans"', 'Inter', 'sans-serif'],
      body:    ['Inter', 'sans-serif'],
    },
  }
}
```

### `cn()` helper (never string concatenation)

```typescript
// lib/utils/cn.ts
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(inputs));
}
```

```tsx
// ✅
<button className={cn('px-4 py-2 rounded-md', isLoading && 'opacity-50 cursor-not-allowed')}>
// ❌
<button className={'px-4 py-2' + (isLoading ? ' opacity-50' : '')}>
```

### Component variants via `cva`

```typescript
import { cva } from 'class-variance-authority';

const buttonVariants = cva('inline-flex items-center rounded-md font-semibold transition-colors', {
  variants: {
    variant: {
      primary:   'bg-power-orange text-white hover:bg-[#b8361d]',
      secondary: 'border border-border-default text-network-blue hover:bg-culture-gray',
      ghost:     'text-secure-gray hover:bg-culture-gray',
      danger:    'bg-danger text-white hover:opacity-90',
    },
    size: {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
});
```

### Class ordering enforced by `prettier-plugin-tailwindcss`

Add to `prettier.config.js`:
```js
module.exports = { plugins: ['prettier-plugin-tailwindcss'] };
```

---

## Testing Strategy

| What | Test type | Tool |
|------|----------|------|
| Pure utility functions (`cn`, `formatters`, `initials`) | Unit | Jest |
| Custom hooks (with mocked API) | Unit | Jest + `renderHook` |
| Shared UI components (`Button`, `StageChip`, `KpiCard`) | Component | RTL |
| Key user flows (login with demo button, search → shortlist) | Integration | RTL |
| E2E (optional for hackathon) | E2E | — |

Test files co-located: `Button.test.tsx` next to `Button.tsx`.
Coverage threshold: 60 % statements on `lib/utils/` and `components/`.

---

## Environment Variables

```
VITE_API_URL=http://localhost:3001
```

Access via `import.meta.env.VITE_API_URL`. No other env vars needed on the frontend.
