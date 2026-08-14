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
| AI | Llama3 via Ollama-compatible HTTP APIs |
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
| `SearchModule` | — | **Four services, not one:** `SearchService` (orchestrator), `RetrievalService` (semantic retrieval), `LlamaService` (AI ranking), `HeuristicService` (fallback) |
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
  llamaBaseUrl: process.env.LLAMA_BASE_URL ?? 'http://localhost:11434',
  llamaApiKey: process.env.LLAMA_API_KEY,
  llamaModel: process.env.LLAMA_MODEL ?? 'llama3',
  llamaEmbedModel: process.env.LLAMA_EMBED_MODEL ?? 'nomic-embed-text',
  rankingProvider: process.env.RANKING_PROVIDER ?? 'llama',
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
});
```

Required env vars (validated at startup via `validationSchema`):
- `DATABASE_URL`
- `JWT_SECRET`

Optional:
- `PORT` (default `3001`)
- `LLAMA_BASE_URL` (default `http://localhost:11434`)
- `LLAMA_API_KEY`
- `LLAMA_MODEL` (default `llama3`)
- `LLAMA_EMBED_MODEL` (default `nomic-embed-text`)
- `RANKING_PROVIDER` (`llama` or `heuristic`, default `llama`)
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

This module has **four services** with distinct responsibilities — do not collapse them.

### Service responsibilities

| File | Owns | Does NOT own |
|------|------|-------------|
| `search.service.ts` | Orchestration flow (steps below), business rules, provider gating, fallback routing | Prompt building, embedding calls, model parsing |
| `retrieval.service.ts` | Effective query composition, query embedding, hybrid retrieval (SQL filters + vector ranking) | Business-rule decisions, response shaping |
| `llama.service.ts` | Prompt construction, Llama API call, Zod validation + one retry | Business logic, DB queries |
| `heuristic.service.ts` | Skill-overlap % scoring + generic why/why-not text | Llama calls, DB queries |

### Request flow (every `POST /search` call)

1. **Validate** — `SearchDto` via global `ValidationPipe` (ircId, query?, scope, jdText?).
2. **Load context** — `SearchService` fetches IRC + parent project from Prisma.
3. **Pre-filter pool** — mandatory-skill overlap check; keeps ≤ `MAX_RANKING_CANDIDATES` (35) candidates.
4. **Build effective query** — normalize and combine manager query and JD text in `retrieval.service.ts`.
5. **Retrieve semantic evidence** — `RetrievalService` embeds query and returns vector-ranked project rows with hard SQL filters.
6. **Rank**:
  - Happy path → `LlamaService.rank(irc, pool, query, jdText)`.
  - Failure path (retrieval/model/parse) → `HeuristicService.rank(irc, pool)`.
7. **Re-hydrate** — replace ALL display fields (`fullName`, `skills`, `location`, `businessUnit`, etc.) with DB data keyed by `employeeId`. Trust model only for `matchPct`, `whyRecommend`, `whyNot`, `conflict`, `conflictNote`.
8. **Duplicate check** — query `pipeline_candidates` to flag any employee already active in a *different* open IRC.
9. **Log** — write `search_logs` row (user, irc, query text, jd filename if any, timestamp).
10. **Return** — sorted by `matchPct` descending.

### Llama3 prompt structure (`llama.service.ts`)

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

### Llama API call contract

- `POST ${LLAMA_BASE_URL}/api/generate`
- Headers: `Authorization: Bearer ${LLAMA_API_KEY}` (when configured), `Content-Type: application/json`
- Body: `{ model: ${LLAMA_MODEL}, prompt: <text>, stream: false }`
- Parse output from response field `response`

### Zod validation schema (output from Llama)

```typescript
const RankedItemSchema = z.object({
  employeeId:    z.number().int(),
  matchPct:      z.number().int().min(0).max(100),
  whyRecommend:  z.string().min(10),
  whyNot:        z.array(z.string()).min(1),
  conflict:      z.boolean(),
  conflictNote:  z.string().optional(),
});
export const LlamaResponseSchema = z.array(RankedItemSchema);
```

### Retrieval flow (`retrieval.service.ts`)

- Builds `effectiveQuery` from manager query and JD text.
- JD handling:
  - supports PDF/DOCX extraction upstream in controller
  - trims and normalizes whitespace/newlines
  - caps text via `JD_TEXT_MAX_LENGTH`
  - falls back to manager query if JD extraction is empty/unusable
- Embedding endpoint:
  - `POST ${LLAMA_BASE_URL}/api/embeddings`
  - Body: `{ model: ${LLAMA_EMBED_MODEL}, prompt: <effectiveQuery> }`
- Hybrid retrieval SQL:
  - hard filters in `WHERE` (scope/rejected/skills)
  - vector cosine ordering on `EmployeeProject.embedding`

### Heuristic fallback (`heuristic.service.ts`)

Used when retrieval or Llama ranking errors/time out/parse-fail. Pure function — no async, no external calls.

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
