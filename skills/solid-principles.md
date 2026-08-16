# SOLID Principles — TalentLens AI Coding Standard

> Applies to: NestJS backend (TypeScript) and React frontend (TypeScript).
> Read this file before proposing any class, service, component, or hook design.

---

## Pre-code Self-Check (run mentally before every implementation)

- [ ] Does this class/component do exactly **one** job?
- [ ] Can I add the new behaviour without editing existing working code?
- [ ] Could a sub-class silently break the parent's contract?
- [ ] Am I forcing callers to depend on methods they don't use?
- [ ] Am I depending on a concrete impl when I should depend on an abstraction?

If any answer is "no", redesign before writing.

---

## S — Single Responsibility Principle

> A class or component should have one — and only one — reason to change.

### ✅ Do this (NestJS)

```typescript
// candidates.service.ts — only handles candidate business logic
@Injectable()
export class CandidatesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(filters: CandidateFiltersDto) {
    return this.prisma.employee.findMany({ where: buildWhere(filters) });
  }
}

// candidates.controller.ts — only handles HTTP: parsing input, calling service, returning response
@Controller('candidates')
export class CandidatesController {
  constructor(private readonly svc: CandidatesService) {}

  @Get()
  list(@Query() filters: CandidateFiltersDto) {
    return this.svc.findAll(filters);
  }
}
```

### ❌ Not this

```typescript
// BAD: controller doing DB queries, business logic, AND HTTP handling
@Controller('candidates')
export class CandidatesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const rows = await this.prisma.employee.findMany();     // DB in controller
    return rows.filter(r => r.benchStatus === 'Bench');    // logic in controller
  }
}
```

### ✅ Do this (React)

```tsx
// useCandidate.ts — data-fetching concern
export function useCandidate(id: string) {
  return useQuery({ queryKey: ['candidate', id], queryFn: () => api.getEmployee(id) });
}

// CandidateProfile.tsx — render concern only
export function CandidateProfile({ id }: { id: string }) {
  const { data, isPending } = useCandidate(id);
  if (isPending) return <Spinner />;
  return <ProfileCard employee={data} />;
}
```

### ❌ Not this

```tsx
// BAD: component fetching, transforming, and rendering all in one
export function CandidateProfile({ id }: { id: string }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch(`/api/employees/${id}`)
      .then(r => r.json())
      .then(d => setData({ ...d, skills: d.skills.sort() }))  // transform here
      .catch(console.error);
  }, [id]);
  return <div>{data?.fullName}</div>;
}
```

---

## O — Open/Closed Principle

> Software entities should be **open for extension** but **closed for modification**.

### ✅ Do this (NestJS)

```typescript
// Base strategy — closed for modification
interface RankingStrategy {
  rank(candidates: Employee[], irc: Irc): RankedCandidate[];
}

// Extend by adding new classes, not editing existing ones
@Injectable()
export class LlmRankingStrategy implements RankingStrategy {
  rank(candidates: Employee[], irc: Irc) { /* LLM call */ }
}

@Injectable()
export class HeuristicRankingStrategy implements RankingStrategy {
  rank(candidates: Employee[], irc: Irc) { /* skill-overlap fallback */ }
}

// SearchService selects strategy; never changes when new strategy is added
@Injectable()
export class SearchService {
  constructor(
    private readonly llm: LlmRankingStrategy,
    private readonly heuristic: HeuristicRankingStrategy,
  ) {}

  rank(candidates: Employee[], irc: Irc, useAi: boolean) {
    const strategy: RankingStrategy = useAi ? this.llm : this.heuristic;
    return strategy.rank(candidates, irc);
  }
}
```

### ✅ Do this (React — component variants)

```tsx
// Open for new variants; closed for existing variant logic
const stageVariants: Record<PipelineStage, string> = {
  'AI Shortlisted':           'bg-celestial-blue text-white',
  'Manager Screening':        'bg-[#D9A400] text-white',
  'Internal Tech Evaluation': 'bg-energy-orange text-white',
  'Client Interview':         'bg-stacked-blue text-white',
  'Selected':                 'bg-commerce-green text-white',
  'Allocated':                'bg-network-blue text-white',
  'Rejected':                 'bg-[#8A8C8E] text-white',
};

export function StageChip({ stage }: { stage: PipelineStage }) {
  return <span className={cn('pill', stageVariants[stage])}>{stage}</span>;
}
```

---

## L — Liskov Substitution Principle

> Derived classes must be substitutable for their base without breaking the program.

### ✅ Do this (NestJS)

```typescript
abstract class BaseRepository<T> {
  abstract findById(id: number): Promise<T | null>;
}

class EmployeeRepository extends BaseRepository<Employee> {
  // Preserves the contract: returns Employee or null, never throws for "not found"
  async findById(id: number) {
    return this.prisma.employee.findUnique({ where: { id } });
  }
}
```

### ❌ Not this

```typescript
class EmployeeRepository extends BaseRepository<Employee> {
  // BREAKS contract: base says null, subclass throws — callers will crash
  async findById(id: number) {
    const emp = await this.prisma.employee.findUnique({ where: { id } });
    if (!emp) throw new Error('not found');  // ← violates LSP
    return emp;
  }
}
```

---

## I — Interface Segregation Principle

> Clients should not be forced to depend on interfaces they don't use. Keep interfaces narrow.

### ✅ Do this (NestJS)

```typescript
// Narrow interfaces — each consumer gets only what it needs
interface IReadCandidates {
  findAll(filters: CandidateFiltersDto): Promise<Employee[]>;
  findById(id: number): Promise<Employee | null>;
}

interface IWriteCandidates {
  addToPipeline(dto: AddToPipelineDto): Promise<PipelineCandidate>;
  updateStage(id: number, stage: PipelineStage): Promise<PipelineCandidate>;
}
```

### ❌ Not this

```typescript
// BAD: one fat interface forces read-only consumers to know about mutations
interface ICandidateService {
  findAll(): Promise<Employee[]>;
  findById(id: number): Promise<Employee | null>;
  addToPipeline(dto: AddToPipelineDto): Promise<PipelineCandidate>;
  updateStage(id: number, stage: PipelineStage): Promise<PipelineCandidate>;
  deletePipelineEntry(id: number): Promise<void>;
  exportCsv(): Promise<string>;
}
```

### ✅ Do this (React — component props)

```tsx
// Narrow prop interfaces — don't pass the whole Employee to a chip
interface StageChipProps { stage: PipelineStage }
interface MatchBadgeProps { matchPct: number }

// ❌ not this
interface BadgeProps { employee: Employee }  // only needs matchPct — too broad
```

---

## D — Dependency Inversion Principle

> High-level modules should not depend on low-level modules. Both should depend on abstractions.

### ✅ Do this (NestJS)

```typescript
// SearchService depends on an abstraction, injected by NestJS DI
@Injectable()
export class SearchService {
  constructor(
    @Inject(RANKING_STRATEGY) private readonly ranking: RankingStrategy,
    private readonly prisma: PrismaService,
  ) {}
}
```

### ✅ Do this (React — API layer abstraction)

```typescript
// api/candidates.ts — component never imports fetch or axios directly
export const candidatesApi = {
  list: (filters: CandidateFilters) =>
    apiClient.get<Employee[]>('/pool', { params: filters }),
  get: (id: string) =>
    apiClient.get<Employee>(`/employees/${id}`),
};

// Component depends on the api abstraction, not on HTTP details
import { candidatesApi } from '@/api/candidates';
```
