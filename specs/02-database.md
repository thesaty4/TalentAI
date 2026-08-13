# Spec 02 — Database: Prisma Schema + Seed

> Tell Copilot: **"implement spec 02"**
> Read `specs/product-overview.md` and `specs/business-rules.md` before starting.

---

## What this spec builds

`server/prisma/schema.prisma` (all models) and `server/prisma/seed.ts` (~65 employees, 4 projects, 5 IRCs, initial pipeline entries).

---

## Prisma schema — all models

File: `server/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           Int       @id @default(autoincrement())
  name         String
  email        String    @unique
  passwordHash String
  role         Role
  title        String?
  employeeId   Int?
  employee     Employee? @relation(fields: [employeeId], references: [id])
  createdAt    DateTime  @default(now())

  projects      Project[]
  notifications Notification[]
  searchLogs    SearchLog[]
}

enum Role {
  manager
  hr
  candidate
}

model Employee {
  id                Int      @id @default(autoincrement())
  employeeCode      String   @unique
  fullName          String
  roleTitle         String
  businessUnit      String
  location          String
  experienceYears   Decimal
  benchStatus       String   @default("Bench")
  currentAllocation String?
  availableDate     DateTime?
  joiningNotice     String?
  createdAt         DateTime @default(now())

  user               User?
  skills             EmployeeSkill[]
  projectHistory     EmployeeProject[]
  ratings            EmployeeRating[]
  pipelineCandidates PipelineCandidate[]
}

model Skill {
  id            Int             @id @default(autoincrement())
  name          String          @unique
  employeeSkills EmployeeSkill[]
}

model EmployeeSkill {
  employee   Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  employeeId Int
  skill      Skill    @relation(fields: [skillId], references: [id], onDelete: Cascade)
  skillId    Int
  @@id([employeeId, skillId])
}

model EmployeeProject {
  id         Int      @id @default(autoincrement())
  employee   Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  employeeId Int
  projectName String
  clientName  String?
  duration    String?
  description String
  domainTags  String[]
}

model EmployeeRating {
  id          Int      @id @default(autoincrement())
  employee    Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  employeeId  Int
  reviewCycle String
  rating      String
}

model Project {
  id        Int      @id @default(autoincrement())
  name      String
  customer  String
  manager   User?    @relation(fields: [managerId], references: [id])
  managerId Int?
  status    String   @default("Active")
  startDate DateTime?
  tags      String[]
  createdAt DateTime @default(now())

  ircs Irc[]
}

model Irc {
  id               Int      @id @default(autoincrement())
  ircCode          String   @unique
  project          Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  projectId        Int
  roleTitle        String
  mandatorySkills  String
  preferredSkills  String?
  experienceRange  String
  location         String
  remotePolicy     String
  openingDate      DateTime
  status           String   @default("Open")

  pipelineCandidates PipelineCandidate[]
  searchLogs         SearchLog[]
}

model PipelineCandidate {
  id            Int      @id @default(autoincrement())
  employee      Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  employeeId    Int
  irc           Irc      @relation(fields: [ircId], references: [id], onDelete: Cascade)
  ircId         Int
  stage         String   @default("AI Shortlisted")
  matchPct      Int?
  whyRecommend  String?
  whyNot        String[]
  conflict      Boolean  @default(false)
  conflictNote  String?
  isDuplicate   Boolean  @default(false)
  duplicateNote String?
  appliedDate   DateTime @default(now())
  updatedAt     DateTime @updatedAt

  feedbackRounds  FeedbackRound[]
  notFitFeedback  NotFitFeedback[]

  @@unique([employeeId, ircId])
}

model FeedbackRound {
  id                  Int               @id @default(autoincrement())
  pipelineCandidate   PipelineCandidate @relation(fields: [pipelineCandidateId], references: [id], onDelete: Cascade)
  pipelineCandidateId Int
  roundName           String
  interviewer         String?
  roundDate           DateTime?
  rating              String?
  comments            String?
}

model Notification {
  id          Int      @id @default(autoincrement())
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId      Int
  title       String
  description String?
  createdAt   DateTime @default(now())
  seen        Boolean  @default(false)
}

model SearchLog {
  id         Int      @id @default(autoincrement())
  user       User?    @relation(fields: [userId], references: [id])
  userId     Int?
  irc        Irc?     @relation(fields: [ircId], references: [id])
  ircId      Int?
  queryText  String?
  jdFilename String?
  createdAt  DateTime @default(now())
}

model NotFitFeedback {
  id                  Int               @id @default(autoincrement())
  pipelineCandidate   PipelineCandidate @relation(fields: [pipelineCandidateId], references: [id], onDelete: Cascade)
  pipelineCandidateId Int
  reason              String
  createdAt           DateTime          @default(now())
}
```

---

## Seed data (`server/prisma/seed.ts`)

### Demo users (password for all: `demo1234`, bcrypt hash)

| Name | Email | Role | Title |
|------|-------|------|-------|
| Prince Verma | prince.verma@fortis.demo | manager | Delivery Manager · Bengaluru |
| Soumyadeep | soumyadeep@fortis.demo | hr | Head of Resourcing · Gurugram |
| Satya Mishra | satya.mishra@fortis.demo | candidate | Senior Software Engineer |

### 8 named employees (exact data — do not vary)

| Code | Name | Role | Skills | Exp | Location | Status | Available | Notice | Project history |
|------|------|------|--------|-----|----------|--------|-----------|--------|----------------|
| EMP1042 | Satya Mishra | Senior Python Engineer | Python, Django, Payments APIs | 6 | Pune | Allocated | 2026-09-02 | 2 weeks | "Spent 8 months building a payments integration for a fintech client, owning reconciliation and settlement flows." |
| EMP1088 | Rohan Mehta | Backend Engineer | Python, Node.js, PostgreSQL | 4 | Bengaluru | Bench | now | none | "Built a claims-processing backend service handling high transaction volume over 1.5 years." |
| EMP1121 | Sara Lin | Full-Stack Engineer | React, Node.js, Python | 5 | Remote | Bench | now | none | "Led the reporting module of a merchant-facing payments dashboard for two years." |
| EMP1155 | Kabir Anand | Platform Engineer | Python, Kubernetes, AWS | 7 | Noida | Allocated | 2026-09-10 | 2 weeks | "Infra lead on a high-volume transaction platform for 3 years — strong reliability track record." |
| EMP1190 | Meena Pillai | QA Automation Engineer | Python, Selenium, CI/CD | 3 | Chennai | Bench | now | none | "Tested payment reconciliation flows at a previous employer for 1 year." |
| EMP1204 | Devika Nair | Backend Engineer | Java, Spring, Python | 5 | Hyderabad | Bench | now | none | "Built REST APIs for an insurance policy management portal, 2 years." *(no payments evidence — AI must down-rank)* |
| EMP1233 | Farah Iqbal | Data Engineer | Python, Spark, Airflow | 6 | Bengaluru | Bench | now | none | "Designed ETL pipelines for a retail analytics platform, 2.5 years." |
| EMP1267 | Tomás Silva | Mobile Engineer | Kotlin, Swift, Python | 4 | Remote | Bench | now | none | "Built a consumer payments mobile app for 1.5 years — owned checkout and wallet flows." *(title mismatch, strong evidence)* |

### ~57 generated employees

Generate programmatically with varied: names (Indian + international), roles (Backend/Frontend/Full-Stack/DevOps/QA/Data/Mobile), locations (Pune, Bengaluru, Noida, Hyderabad, Chennai, Mumbai, Gurugram, Remote), business units (Payments & FinTech, Healthcare, Logistics, Retail, Digital Platform), experience (2–12 yrs), bench/allocated mix, specific 1–2 sentence project histories.

Each generated employee must have at least one `EmployeeProject` with a real-sounding domain-specific description — not generic filler.

### Projects (4)

| Name | Customer | Manager | Status | Start |
|------|----------|---------|--------|-------|
| Payments Platform — Phase 2 | Northwind Financial | Prince Verma | Active | 2025-10-01 |
| Claims Automation Revamp | Meridian Health | Prince Verma | Active | 2025-12-01 |
| Logistics Tracker API | Atlas Freight | Devraj Rao* | Active | 2026-01-15 |
| Retail Loyalty Engine | Corestone Retail | Devraj Rao* | On hold | 2026-03-01 |

*Devraj Rao: seed as an additional manager user (`devraj.rao@fortis.demo`, manager role).

### IRCs (5)

| Code | Project | Role | Mandatory | Preferred | Exp | Location | Remote |
|------|---------|------|-----------|-----------|-----|----------|--------|
| IRC104521 | Payments Platform Phase 2 | Senior Python Engineer | Python, Payments APIs | Django, Kafka | 4-7 yrs | Pune | Hybrid |
| IRC104589 | Payments Platform Phase 2 | DevOps Engineer | Kubernetes, AWS | Terraform | 4-7 yrs | Bengaluru | Remote friendly |
| IRC208833 | Claims Automation Revamp | Backend Engineer | Python, Kubernetes | AWS | 4-7 yrs | Noida | Hybrid |
| IRC311290 | Logistics Tracker API | QA Automation Engineer | Python, Selenium | CI/CD | 2-4 yrs | Chennai | Onsite only |
| IRC417765 | Retail Loyalty Engine | Backend Engineer | Java, Spring | Python | 4-7 yrs | Hyderabad | Hybrid |

### Initial pipeline entries (for IRC104521)

| Employee | Stage | matchPct |
|----------|-------|---------|
| Satya Mishra | Manager Screening | 92 |
| Rohan Mehta | AI Shortlisted | 78 |
| Sara Lin | AI Shortlisted | 71 |

Seed 1 `FeedbackRound` for Satya Mishra's pipeline entry: round = "Manager screening", interviewer = "Prince Verma", date = yesterday, rating = "Strong yes".

Seed 2–3 `Notification` rows for Prince Verma ("Satya Mishra moved to Manager Screening", "New application: Rohan Mehta for IRC104521").

---

## Acceptance criteria

- `npx prisma migrate dev --name init` runs without errors.
- `npx prisma db seed` populates all tables.
- `prisma studio` shows 65+ employees, 4 projects, 5 IRCs, 3 pipeline entries for IRC104521.
- Satya Mishra's `User` row has `employeeId` linked to EMP1042's `Employee` row.
