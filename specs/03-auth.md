# Spec 03 — Auth Module

> Tell Copilot: **"implement spec 03"**
> Depends on: spec 01 (scaffold), spec 02 (database).
> Read `specs/business-rules.md` R18, R22 before starting.

---

## What this spec builds

`server/src/auth/` — signup, login, demo-login, JWT strategy, `JwtAuthGuard`, `RolesGuard`, `@CurrentUser()` decorator.

---

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/signup` | Public | Create account → return JWT |
| `POST` | `/auth/login` | Public | Email + password → return JWT |
| `POST` | `/auth/demo-login/:role` | Public | Instant JWT for seeded demo user (R22) |

All other endpoints in the app require `JwtAuthGuard`.

---

## DTOs

**`signup.dto.ts`**
```typescript
name: string          // @IsString @MinLength(2)
email: string         // @IsEmail
password: string      // @IsString @MinLength(8)
role?: Role           // @IsOptional @IsEnum(Role) — default: manager
```

**`login.dto.ts`**
```typescript
email: string         // @IsEmail
password: string      // @IsString
```

---

## Auth service rules

- `signup`: hash password with `bcryptjs` (cost 12), create `User`, return `{ token, user }`.
- `login`: find user by email, compare hash, throw `UnauthorizedException` on mismatch, return `{ token, user }`.
- `demo-login`: look up fixed email by role — manager→`prince.verma@fortis.demo`, hr→`soumyadeep@fortis.demo`, candidate→`satya.mishra@fortis.demo`. No password check. Throw `NotFoundException` if seed not present. (R22 — demo convenience, not production auth)
- Token payload: `{ sub: user.id, email, role, name }`. Expiry: `7d`.
- Never return `passwordHash` in any response.

---

## JWT strategy

`passport-jwt` with `ExtractJwt.fromAuthHeaderAsBearerToken()`. Validates signature and expiry. Attaches decoded payload as `req.user`.

---

## Guards + decorator

**`JwtAuthGuard`** — extends `AuthGuard('jwt')`. Applied globally in `app.module.ts` except routes decorated with `@Public()`.

**`RolesGuard`** — checks `req.user.role` against `@Roles(...)` decorator metadata.

**`@CurrentUser()`** — param decorator that extracts `req.user` from the request.

**`@Public()`** — metadata decorator that marks a route as public (bypasses `JwtAuthGuard`).

---

## Acceptance criteria

- `POST /auth/signup` with valid body → `201` + `{ token, user }` (no passwordHash).
- `POST /auth/login` wrong password → `401 Unauthorized`.
- `POST /auth/demo-login/manager` → `200` + valid JWT for Prince Verma.
- `POST /auth/demo-login/hr` → JWT for Soumyadeep.
- `POST /auth/demo-login/candidate` → JWT for Satya Mishra.
- Any protected endpoint without token → `401`.
- Swagger shows all 3 endpoints under `@ApiTags('auth')`.
