import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EMBEDDING_DIMENSIONS } from '../common/constants/search.constants';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pgvector = require('pgvector') as { toSql: (v: number[]) => string };

interface OllamaEmbedResponse {
  embeddings?: number[][];
}

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // Auto-embed any employees missing a vector on startup (fire-and-forget)
  onModuleInit() {
    const provider = this.config.get<string>('embeddingProvider') ?? 'none';
    if (provider === 'none') return;

    this.prisma
      .$queryRaw<[{ missing: bigint }]>(
        Prisma.sql`SELECT COUNT(*) AS missing FROM "Employee" WHERE embedding IS NULL`,
      )
      .then(([{ missing }]) => {
        if (missing === 0n) {
          this.logger.log('All employee embeddings are up to date.');
          return;
        }
        this.logger.log(`${missing} employees missing embeddings — starting background embed job.`);
        this.embedAll().catch(err =>
          this.logger.error(`Startup embed job failed: ${(err as Error).message}`),
        );
      })
      .catch(err => this.logger.warn(`Could not check embedding status: ${(err as Error).message}`));
  }

  async embedEmployee(employeeId: number): Promise<void> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { skills: { include: { skill: true } }, projectHistory: true },
    });
    if (!employee) return;

    const text   = this.buildProfileText(
      employee.skills.map(es => es.skill.name),
      employee.projectHistory.map(p => p.description),
    );
    const vector = await this.fetchEmbedding(text);
    if (!vector) return;

    await this.prisma.$executeRaw(
      Prisma.sql`UPDATE "Employee" SET embedding = ${pgvector.toSql(vector)}::vector WHERE id = ${employeeId}`,
    );
  }

  async embedAll(): Promise<{ embedded: number; failed: number }> {
    // Only fetch employees without an embedding — safe to call repeatedly
    const employees = await this.prisma.$queryRaw<{ id: number }[]>(
      Prisma.sql`SELECT id FROM "Employee" WHERE embedding IS NULL`,
    );
    const ids = employees.map(e => e.id);

    let embedded = 0;
    let failed   = 0;

    for (const id of ids) {
      try {
        await this.embedEmployee(id);
        embedded++;
        this.logger.log(`Embedded ${id} (${embedded}/${ids.length})`);
      } catch (err) {
        this.logger.warn(`Failed to embed employee ${id}: ${(err as Error).message}`);
        failed++;
      }
    }

    return { embedded, failed };
  }

  async findSimilar(queryText: string, limit: number): Promise<number[]> {
    const vector = await this.fetchEmbedding(queryText);
    if (!vector) throw new Error('Embedding API returned no vector for query');

    // $queryRawUnsafe is safe — pgvector.toSql() produces only floats, brackets, commas, minus signs
    const vectorStr = pgvector.toSql(vector);
    const rows = await this.prisma.$queryRawUnsafe<{ id: number | bigint }[]>(
      `SELECT id FROM "Employee" WHERE embedding IS NOT NULL ORDER BY embedding <=> '${vectorStr}'::vector LIMIT ${limit}`,
    );
    this.logger.log(`findSimilar: returned ${rows.length} candidates for top-${limit}`);
    return rows.map(r => Number(r.id));
  }

  // Plain prose only — embedding models are trained on prose, not structured JSON
  private buildProfileText(skills: string[], descriptions: string[]): string {
    const skillsPart = skills.join(', ');
    const descPart   = descriptions.filter(Boolean).join('. ');
    return [skillsPart, descPart].filter(Boolean).join('. ');
  }

  private async fetchEmbedding(text: string): Promise<number[] | null> {
    const baseUrl = this.config.get<string>('embeddingBaseUrl');
    const model   = this.config.get<string>('embeddingModel');
    const apiKey  = this.config.get<string>('llmApiKey');
    if (!baseUrl || !model) return null;

    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/embed`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body:    JSON.stringify({ model, input: text }),
    });

    if (!response.ok) {
      throw new Error(`Embedding API ${response.status}: ${response.statusText}`);
    }

    const data   = await response.json() as OllamaEmbedResponse;
    const vector = data.embeddings?.[0];
    if (!vector) throw new Error('Embedding API returned empty embeddings array');

    // Dimension mismatch = model/schema mismatch; update EMBEDDING_DIMENSIONS or vector(N) in migration
    if (vector.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(`Embedding dimension mismatch: got ${vector.length}, expected ${EMBEDDING_DIMENSIONS}`);
    }

    return vector;
  }
}
