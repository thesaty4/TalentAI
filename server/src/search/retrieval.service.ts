import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { JD_TEXT_MAX_LENGTH, MAX_RANKING_CANDIDATES } from '../common/constants/search.constants';
import { PrismaService } from '../prisma/prisma.service';

export interface RetrievedRow {
  employeeId:  number;
  projectName: string;
  duration:    string | null;
  description: string;
  domainTags:  string[];
  distance:    number;
}

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /** Combines query + JD text into a single embedding/prompt input. */
  buildEffectiveQuery(query?: string, jdText?: string): string {
    const trimmedQuery = query?.trim() ?? '';
    // Normalise: trim, collapse repeated whitespace/newlines, cap to avoid oversized embeddings
    const normalizedJd = jdText
      ? jdText.trim().replace(/\s+/g, ' ').slice(0, JD_TEXT_MAX_LENGTH)
      : '';

    if (!normalizedJd && jdText && trimmedQuery) {
      this.logger.warn('JD extraction was empty or unusable; falling back to manager query');
    }
    if (!normalizedJd && jdText && !trimmedQuery) {
      this.logger.warn('JD extraction was empty or unusable and no manager query was provided');
    }

    if (normalizedJd && trimmedQuery) {
      return `Manager Query:\n${trimmedQuery}\n\nJD Text:\n${normalizedJd}`;
    }
    return normalizedJd || trimmedQuery;
  }

  /**
   * Returns the best single string for EMBEDDING — preserves user query intent.
   * When query is present it is used alone (precise intent signal).
   * JD is only used when no typed query exists, and is capped at 500 chars to avoid
   * diluting the embedding with boilerplate JD text.
   */
  buildEmbeddingQuery(query?: string, jdText?: string): string {
    const trimmedQuery = query?.trim() ?? '';
    if (trimmedQuery) return trimmedQuery;
    // No typed query — use first 500 chars of JD to capture core role intent
    return jdText?.trim().replace(/\s+/g, ' ').slice(0, 500) ?? '';
  }

  async embedQuery(text: string): Promise<number[]> {
    const baseUrl = this.config.get<string>('llamaBaseUrl');
    const apiKey  = this.config.get<string>('llamaApiKey');
    const model   = this.config.get<string>('llamaEmbedModel') ?? 'nomic-embed-text';

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/embeddings`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ model, prompt: text }),
      });
    } catch (err: unknown) {
      const msg = (err as Error).message ?? '';
      // Surface a clear error so the orchestrator can fall back to heuristic
      throw new Error(`Embedding service unreachable at ${baseUrl}: ${msg}`);
    }

    if (!res.ok) {
      throw new Error(`Embedding API returned ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as { embedding: number[] };
    if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
      throw new Error('Embedding API returned an empty or invalid vector');
    }
    return data.embedding;
  }

  /**
   * Runs hybrid retrieval: mandatory-skill / scope constraints as SQL WHERE,
   * semantic ordering by cosine distance on project_experience embeddings.
   * Returns top rows across all matching employees (caller groups by employeeId).
   */
  async retrieveByContext(
    queryEmbedding: number[],
    filters: {
      employeeIds?:   number[];   // hard scope restriction (applied / pool members)
      excludeIds?:    number[];   // rejected employee ids for this IRC
      requiredSkills?: string[]; // mandatory skill hard filter
    },
    limit = MAX_RANKING_CANDIDATES,
  ): Promise<RetrievedRow[]> {
    // Build vector literal from model output — all values are explicit floats, safe to inline
    const vectorStr = `[${queryEmbedding.map(n => Number(n).toFixed(8)).join(',')}]`;
    const safeLimit = Math.min(Math.max(parseInt(String(limit), 10), 1), 100);

    // Integer arrays from Prisma records — safe as parameterized values
    const empIds = (filters.employeeIds  ?? []).map(id => parseInt(String(id), 10));
    const excIds = (filters.excludeIds   ?? []).map(id => parseInt(String(id), 10));
    const skills = filters.requiredSkills ?? [];

    const empFilter = empIds.length > 0
      ? Prisma.sql`AND ep."employeeId" IN (${Prisma.join(empIds)})`
      : Prisma.empty;

    const excFilter = excIds.length > 0
      ? Prisma.sql`AND ep."employeeId" NOT IN (${Prisma.join(excIds)})`
      : Prisma.empty;

    const skillFilter = skills.length > 0
      ? Prisma.sql`AND ep."employeeId" IN (
          SELECT es."employeeId" FROM "EmployeeSkill" es
          JOIN   "Skill"         s  ON s.id = es."skillId"
          WHERE  s.name IN (${Prisma.join(skills)})
        )`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<RetrievedRow[]>(Prisma.sql`
      SELECT
        ep."employeeId"  AS "employeeId",
        ep."projectName" AS "projectName",
        ep.duration      AS duration,
        ep.description   AS description,
        ep."domainTags"  AS "domainTags",
        (ep.embedding <=> ${vectorStr}::vector) AS distance
      FROM "EmployeeProject" ep
      WHERE ep.embedding IS NOT NULL
        ${empFilter}
        ${excFilter}
        ${skillFilter}
      ORDER BY ep.embedding <=> ${vectorStr}::vector
      LIMIT ${safeLimit}
    `);

    this.logger.debug(`retrieveByContext: ${rows.length} rows returned`);
    return rows;
  }
}
