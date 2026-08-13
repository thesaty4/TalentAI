# Spec 11 — Login / Signup Page

> Tell Copilot: **"implement spec 11"**
> Depends on: spec 10 (scaffold).

---

## What this spec builds

`client/src/pages/auth/LoginPage.tsx` — the full login/signup screen.

---

## Layout

Two tabs: **Log in** / **Sign up**. Centered card on a muted background (`bg-culture-gray`). Logo + "TalentLens AI" at the top.

---

## Log in tab

- Email field + Password field (with show/hide toggle using `lucide-react` `Eye`/`EyeOff` icon).
- "Remember me" checkbox (stores token in localStorage vs. sessionStorage — for demo, localStorage is fine always).
- "Forgot password?" link — no-op (`href="#"`).
- **Submit button** ("Log in") — `variant: primary` (`bg-power-orange`).
- On success: store token + user → `navigate('/dashboard')`.
- On error: show inline error banner below the form.

## Sign up tab

- Full name, Work email, Password, Confirm password fields.
- Role selector (`manager | hr | candidate`).
- Terms checkbox ("I agree to the terms of service").
- **Submit button** ("Create account").
- On success: same as login — store + navigate.
- Client-side validation: passwords must match; all fields required.

## Demo login block

A visually distinct section below the tabs — a light card with label **"Demo login (judging only)"** and three buttons side by side:

```
[  Manager  ]  [  HR  ]  [  Candidate  ]
```

Each button calls `POST /auth/demo-login/:role`, then stores token + user and navigates to `/dashboard`. Buttons show a `<Spinner />` while the request is in flight.

---

## API calls

```typescript
// lib/api/auth.api.ts
export const authApi = {
  login:     (dto: LoginDto) => apiClient.post('/auth/login', dto).then(r => r.data),
  signup:    (dto: SignupDto) => apiClient.post('/auth/signup', dto).then(r => r.data),
  demoLogin: (role: 'manager' | 'hr' | 'candidate') =>
               apiClient.post(`/auth/demo-login/${role}`).then(r => r.data),
};
```

---

## Acceptance criteria

- Demo Manager button → logs in as Prince Verma → redirects to `/dashboard` → sidebar shows Manager nav.
- Demo HR button → logs in as Soumyadeep → sidebar shows HR nav (same links as manager for now).
- Demo Candidate button → logs in as Satya Mishra → sidebar shows Candidate nav.
- Wrong password on login → inline error message shown.
- Sign up with mismatched passwords → client-side validation error shown before API call.
