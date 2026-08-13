# Backend Architecture — TalentLens AI Server

> Follow the same coding standards defined in `/skills/solid-principles.md` and `/skills/dry-clean-code.md`.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | NestJS (TypeScript) |
| ORM | Prisma |
| Database | PostgreSQL |
| Auth | JWT via `@nestjs/jwt` + Passport (`passport-jwt`) |
| Validation | `class-validator` + `class-transformer` (global `ValidationPipe`) |
| API docs | Swagger/OpenAPI via `@nestjs/swagger` |
| Health check | `@nestjs/terminus` |
| AI | `@google/generative-ai` (Gemini) |
| File upload | `multer` (NestJS built-in wrapper) |
| Config | `@nestjs/config` with Joi schema validation |
| Password hashing | `bcryptjs` |

---

## Module Structure

Every domain feature is one NestJS module. Module boundaries are strict — a module exports only what other modules need.

```
Controller  →  Service  →  PrismaService
     ↑                          ↑
     |__ DTOs (in/out) ________|__ Prisma types
```

- **Controller**: parse HTTP input via DTOs, call service, return result. No DB or business logic.
- **Service**: enforce business rules, orchestrate across repositories. No HTTP context.
- **PrismaService**: wraps `PrismaClient` as a NestJS singleton. No business logic.

### Module list

| Module | Exports | Notes |
|--------|---------|-------|
| `AuthModule` | `JwtStrategy`, `JwtAuthGuard` | Sets up Passport; no other module depends on auth logic directly |
| `PrismaModule` | `PrismaService` | Global module — available everywhere without re-importing |
| `ProjectsModule` | — | Scoped by manager vs HR via `RolesGuard` |
| `IrcsModule` | — | Sub-resource of projects |
| `SearchModule` | — | **Three services, not one:** `SearchService` (orchestrator), `GeminiService` (AI), `HeuristicService` (fallback) |
| `PipelineModule` | — | |
| `PoolModule` | — | |
| `EmployeesModule` | — | |
| `CandidateModule` | — | Candidate-role-only endpoints |
| `NotificationsModule` | — | |
| `HealthModule` | — | |

---

## DTOs & Validation

All incoming request bodies, query params, and route params must be typed via DTO classes decorated with `class-validator`.

```typescript
// ✅ correct pattern
import { IsString, IsInt, IsIn, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchDto {
  @ApiProperty()
  @IsInt()
  ircId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  query?: string;

  @ApiProperty({ enum: ['all', 'applied'] })
  @IsIn(['all', 'applied'])
  scope: 'all' | 'applied';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jdText?: string;
}
```

Enable globally in `main.ts`:

```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,        // strip unknown properties
  forbidNonWhitelisted: true,
  transform: true,        // auto-cast primitives
}));
```

---

## Global Conventions

### Exception filter

A single `GlobalExceptionFilter` catches all unhandled exceptions. Every error leaves with the shape:

```json
{ "statusCode": 422, "message": "Validation failed", "error": "Unprocessable Entity" }
```

Register in `main.ts`:
```typescript
app.useGlobalFilters(new GlobalExceptionFilter());
```

### Response shape

All list endpoints return:
```json
{
  "data": [...],
  "meta": { "total": 120, "page": 1, "limit": 20, "pages": 6 }
}
```

A `TransformInterceptor` wraps single-item responses in `{ "data": {...} }` automatically. The interceptor is applied globally.

### Config / env management

`@nestjs/config` with Joi validation schema — the app refuses to start if a required env var is missing.

```typescript
// config/configuration.ts
export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-1.5-flash',
  geminiBaseUrl: process.env.GEMINI_BASE_URL,
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
});
```

Required env vars (validated at startup via `validationSchema`):
- `DATABASE_URL`
- `JWT_SECRET`
- `GEMINI_API_KEY`

Optional:
- `PORT` (default `3001`)
- `GEMINI_MODEL` (default `gemini-1.5-flash`)
- `GEMINI_BASE_URL`
- `CLIENT_URL`

---

## Auth Flow

1. `POST /auth/signup` — hash password with `bcryptjs`, create `User` in DB, return JWT.
2. `POST /auth/login` — verify password, return JWT.
3. `POST /auth/demo-login/:role` — look up seeded demo user by role, return JWT without password check (demo only).
4. All other endpoints require `Authorization: Bearer <token>` validated by `JwtAuthGuard`.
5. `@CurrentUser()` decorator extracts `{ id, email, role, name }` from the validated JWT payload.
6. `RolesGuard` + `@Roles('manager', 'hr')` restrict endpoints by role.

JWT payload shape:
```typescript
interface JwtPayload {
  sub: number;     // user.id
  email: string;
  role: 'manager' | 'hr' | 'candidate';
  name: string;
}
```

---

## Swagger Conventions

Every controller must have `@ApiTags('feature-name')`.
Every DTO property must have `@ApiProperty()` or `@ApiPropertyOptional()`.
Every endpoint must have `@ApiOperation({ summary: '…' })`.
Swagger UI served at `/api/docs`.

```typescript
// main.ts setup
const config = new DocumentBuilder()
  .setTitle('TalentLens AI API')
  .setVersion('1.0')
  .addBearerAuth()
  .build();
const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);
```

---

## Health Endpoint

`GET /health` — returns `{ status: 'ok', info: { database: { status: 'up' } } }`.

Uses `@nestjs/terminus` with a `PrismaHealthIndicator` that runs a lightweight `prisma.$queryRaw('SELECT 1')`.

---

## Database (Prisma)

- Schema file: `server/prisma/schema.prisma`.
- Migrations: `npx prisma migrate dev --name <description>` — committed to source control.
- Seeding: `server/prisma/seed.ts` run via `npx prisma db seed`.
- Model naming: `PascalCase` singular (`Employee`, `PipelineCandidate`).
- Field naming: `camelCase` (`employeeCode`, `benchStatus`, `createdAt`).
- All timestamps: `DateTime @default(now())` / `@updatedAt`.

### Seed data (`prisma/seed.ts`)

Seeds the following for demo:

| What | Count |
|------|-------|
| Demo users | 3 (manager: prince.verma, hr: soumyadeep, candidate: satya.mishra) |
| Employees | ~65 (8 named from spec + 57 programmatically generated) |
| Projects | 4 |
| IRCs | 5 |
| Pipeline entries (initial) | Several across IRC104521 at different stages |
| Feedback rounds | Some for Satya Mishra's pipeline entries |
| Notifications | A few per demo user |

---

## AI Search Flow (`search/` module)

This module has **three services** with distinct responsibilities — do not collapse them.

### Service responsibilities

| File | Owns | Does NOT own |
|------|------|-------------|
| `search.service.ts` | Orchestration flow (steps 1–10 below) | Prompt building, Gemini calls, scoring logic |
| `gemini.service.ts` | Prompt construction, Gemini API call, Zod validation | Business logic, DB queries |
| `heuristic.service.ts` | Skill-overlap % scoring + generic why/why-not text | Gemini, DB queries |

### Request flow (every `POST /search` call)

1. **Validate** — `SearchDto` via global `ValidationPipe` (ircId, query?, scope, jdText?).
2. **Load context** — `SearchService` fetches IRC + parent project from Prisma.
3. **Pre-filter pool** — cheap mandatory-skill overlap check; keeps ≤ `MAX_GEMINI_CANDIDATES` (35) candidates to cap Gemini prompt size.
4. **Rank**:
   - Happy path → `GeminiService.rank(irc, pool, query, jdText)` — builds prompt, calls Gemini with JSON response mode, validates output with Zod.
   - Failure path → `HeuristicService.rank(irc, pool)` — pure skill-overlap scorer, no external calls.
5. **Re-hydrate** — for each result, replace ALL display fields (`fullName`, `skills`, `location`, `businessUnit`, etc.) with DB data keyed by `employeeId`. Trust model only for `matchPct`, `whyRecommend`, `whyNot`, `conflict`, `conflictNote`.
6. **Duplicate check** — query `pipeline_candidates` to flag any employee already active in a *different* open IRC.
7. **Log** — write `search_logs` row (user, irc, query text, jd filename if any, timestamp).
8. **Return** — sorted by `matchPct` descending.

### Gemini prompt structure (`gemini.service.ts`)

```
SYSTEM: You are an internal staffing analyst. Score candidates by real project evidence,
        not just overlapping skill tags. Return strict JSON only per the provided schema.

USER:
  ## Open Requisition
  <IRC details: role, mandatory skills, preferred skills, experience range, location, remote policy>

  ## Manager's requirement
  <free-text query and/or extracted JD text>

  ## Candidate pool
  <JSON array — each entry: employeeId, skills[], experienceYears, currentAllocation,
   availableDate, joiningNotice, projectHistory[{projectName, duration, description}]>
```

### Zod validation schema (output from Gemini)

```typescript
const RankedItemSchema = z.object({
  employeeId:    z.number().int(),
  matchPct:      z.number().int().min(0).max(100),
  whyRecommend:  z.string().min(10),
  whyNot:        z.array(z.string()),
  conflict:      z.boolean(),
  conflictNote:  z.string().optional(),
});
export const GeminiResponseSchema = z.array(RankedItemSchema);
```

### Heuristic fallback (`heuristic.service.ts`)

Used when Gemini errors or times out. Pure function — no async, no external calls.

Score = `(mandatory skill matches / total mandatory skills) × 100`, capped at 85.
`whyRecommend` = generic sentence listing matched skills.
`whyNot` = list of unmatched mandatory skills.

---

## CORS & Security

```typescript
app.use(helmet());
app.enableCors({ origin: configService.get('clientUrl'), credentials: true });
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));
```

---

## Scripts

```json
{
  "dev": "nest start --watch",
  "build": "nest build",
  "start": "node dist/main",
  "migrate": "prisma migrate dev",
  "seed": "prisma db seed",
  "test": "jest",
  "test:e2e": "jest --config ./test/jest-e2e.json"
}
```
