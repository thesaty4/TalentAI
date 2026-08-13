# Spec 01 — Backend Scaffold

> Tell Copilot: **"implement spec 01"**
> Copilot must read `specs/product-overview.md`, `specs/business-rules.md`, and `server/docs/architecture.md` before starting.

---

## What this spec builds

The NestJS server project skeleton — no business logic yet, just the working scaffold that all other specs build on top of.

---

## Deliverables

### `server/` folder (new NestJS project)

Initialize with `nest new server --package-manager npm --skip-git` or create files manually.

**`server/package.json`** — key dependencies:

```json
{
  "dependencies": {
    "@nestjs/common": "^10",
    "@nestjs/core": "^10",
    "@nestjs/platform-express": "^10",
    "@nestjs/jwt": "^10",
    "@nestjs/passport": "^10",
    "@nestjs/config": "^3",
    "@nestjs/swagger": "^7",
    "@nestjs/terminus": "^10",
    "@prisma/client": "^5",
    "passport": "^0.6",
    "passport-jwt": "^4",
    "bcryptjs": "^2.4",
    "class-validator": "^0.14",
    "class-transformer": "^0.5",
    "joi": "^17",
    "@google/generative-ai": "^0.21",
    "multer": "^1.4",
    "pdf-parse": "^1.1",
    "mammoth": "^1.8",
    "zod": "^3"
  },
  "devDependencies": {
    "prisma": "^5",
    "@types/bcryptjs": "^2",
    "@types/multer": "^1",
    "@types/passport-jwt": "^4",
    "ts-node": "^10",
    "@nestjs/cli": "^10"
  }
}
```

**`server/nest-cli.json`**
```json
{ "collection": "@nestjs/schematics", "sourceRoot": "src", "compilerOptions": { "deleteOutDir": true } }
```

**`server/tsconfig.json`** — strict mode on, path aliases off (Prisma handles types).

**`server/src/main.ts`** — bootstrap with:
- `ValidationPipe` (whitelist, forbidNonWhitelisted, transform)
- `GlobalExceptionFilter`
- Swagger (`/api/docs`)
- Helmet
- CORS (from `CLIENT_URL` config)
- Rate limiter (200 req / 15 min)

**`server/src/app.module.ts`** — root module. Import `ConfigModule.forRoot` with Joi validation. Leave feature module imports as stubs (`// TODO: add XModule`).

**`server/src/config/configuration.ts`** — typed config factory:
```typescript
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

Required env vars validated at startup (Joi): `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`.

**`server/src/common/filters/global-exception.filter.ts`** — catches all exceptions, returns `{ statusCode, message, error }`.

**`server/src/common/interceptors/transform.interceptor.ts`** — wraps responses in `{ data: … }`.

**`server/src/prisma/prisma.module.ts`** + **`prisma.service.ts`** — global module, `PrismaClient` singleton, implements `OnModuleInit` / `OnModuleDestroy`.

**`server/src/health/health.controller.ts`** — `GET /health` via `@nestjs/terminus`, checks DB with `prisma.$queryRaw\`SELECT 1\``.

### Root `package.json` (monorepo scripts)

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev --prefix server\" \"npm run dev --prefix client\"",
    "setup-db": "cd server && npx prisma migrate dev && npx prisma db seed"
  },
  "devDependencies": { "concurrently": "^8" }
}
```

### `.env.example` (workspace root)

```
DATABASE_URL=postgres://postgres:password@localhost:5432/talentlens
JWT_SECRET=change_me_32_chars_minimum
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-1.5-flash
GEMINI_BASE_URL=
PORT=3001
CLIENT_URL=http://localhost:5173
VITE_API_URL=http://localhost:3001
```

---

## Acceptance criteria

- `cd server && npm run start:dev` starts without errors.
- `GET /health` returns `{ status: 'ok' }`.
- `GET /api/docs` shows the Swagger UI.
- Missing env var at startup causes a clear validation error (not a silent crash).
