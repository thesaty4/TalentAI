---
applyTo: "server/**"
description: "TalentLens AI backend standards. Apply to all NestJS server files — controllers, services, modules, DTOs, guards, filters, Prisma schema, seed. Covers SRP layer rules, DTO creation order, NestJS exception usage, Swagger decoration, Prisma naming, and backend folder placement."
---

# TalentLens AI — Backend Standards

Stack: NestJS · Prisma · PostgreSQL · JWT (`@nestjs/jwt`) · Swagger (`@nestjs/swagger`) · `@nestjs/terminus`

---

## SRP — never mix layers

```typescript
// ✅ Controller: HTTP only. Service: logic only. Never mixed.
@Controller('pipeline')
export class PipelineController {
  constructor(private readonly svc: PipelineService) {}
  @Patch(':id') update(@Param('id') id: number, @Body() dto: UpdateStageDto) {
    return this.svc.updateStage(id, dto);
  }
}
// ❌ Never call Prisma inside a controller.
// ❌ Never handle HTTP inside a service.
```

---

## Module creation order

**DTO → Service → Controller → Module file**

Every incoming request body, query param, and route param must be a DTO decorated with `class-validator` + `@ApiProperty`.

```typescript
export class UpdateStageDto {
  @ApiProperty({ enum: PIPELINE_STAGES })
  @IsIn(PIPELINE_STAGES)
  stage: PipelineStage;
}
```

Global `ValidationPipe` in `main.ts`:
```typescript
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
```

---

## Error handling — NestJS exceptions only

```typescript
// ✅
throw new NotFoundException('Employee not found');
throw new BadRequestException('IRC must be Open');
throw new ConflictException('Candidate already in pipeline');
// ❌  throw new Error('not found')
```

Every error response shape: `{ statusCode, message, error }` — enforced by `GlobalExceptionFilter`.

---

## Swagger — decorate every endpoint

```typescript
@ApiTags('pipeline')
@ApiBearerAuth()
@Controller('pipeline')
export class PipelineController {
  @ApiOperation({ summary: 'Move candidate to next stage' })
  @ApiParam({ name: 'id', type: Number })
  @Patch(':id')
  update(@Param('id') id: number, @Body() dto: UpdateStageDto) { … }
}
```

No undocumented endpoint. Every DTO property: `@ApiProperty` or `@ApiPropertyOptional`.

---

## Folder placement

```
server/src/
├── common/
│   ├── constants/          ← PIPELINE_STAGES, MAX_GEMINI_CANDIDATES, ROLES
│   ├── decorators/         ← @CurrentUser()
│   ├── filters/            ← GlobalExceptionFilter
│   ├── guards/             ← JwtAuthGuard, RolesGuard
│   ├── interceptors/       ← TransformInterceptor  ({ data, meta } wrapper)
│   └── utils/              ← pure functions, zero NestJS deps
├── config/                 ← @nestjs/config + Joi validation
├── prisma/                 ← PrismaService (global module)
├── auth/                   ← signup / login / demo-login / JWT strategy
│   ├── dto/
│   └── strategies/
├── projects/  ircs/  pool/  employees/  pipeline/  candidate/  notifications/
│   └── dto/   (each: module + controller + service + dto/)
├── health/                 ← GET /health via @nestjs/terminus
└── search/                 ← see talentlens-ai-search.instructions.md
```

---

## Prisma conventions

- Schema: `server/prisma/schema.prisma`
- Model names: `PascalCase` singular (`Employee`, `PipelineCandidate`)
- Field names: `camelCase` (`employeeCode`, `benchStatus`, `createdAt`)
- All timestamps: `DateTime @default(now())` or `@updatedAt`
- Migrations: `npx prisma migrate dev --name <description>` — commit to source control
- Seeding: `server/prisma/seed.ts` via `npx prisma db seed`
