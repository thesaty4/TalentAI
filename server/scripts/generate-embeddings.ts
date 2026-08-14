/**
 * One-time embedding ingestion: finds EmployeeProject rows with null embeddings,
 * calls the configured embedding endpoint, and writes vectors back.
 *
 * Usage:
 *   npm run embed
 *
 * Required env (loaded from .env):
 *   LLAMA_BASE_URL   — base URL of the Ollama/Llama instance (e.g. http://localhost:11434)
 *   LLAMA_API_KEY    — Bearer token (optional if endpoint is open)
 *   LLAMA_EMBED_MODEL — embedding model name (default: nomic-embed-text)
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma        = new PrismaClient();
const BASE_URL      = process.env.LLAMA_BASE_URL      ?? 'http://localhost:11434';
const API_KEY       = process.env.LLAMA_API_KEY;
const EMBED_MODEL   = process.env.LLAMA_EMBED_MODEL   ?? 'nomic-embed-text';

async function embedText(text: string): Promise<number[]> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/embeddings`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
      },
      body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
    });
  } catch (err: unknown) {
    const msg = (err as Error).message ?? '';
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
      console.error(`\nCannot reach embedding service at ${BASE_URL}/api/embeddings`);
      console.error('Make sure LLAMA_BASE_URL is set and the service is running.');
      process.exit(1);
    }
    throw err;
  }

  if (!res.ok) {
    throw new Error(`Embedding API returned ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as { embedding: number[] };
  if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
    throw new Error('Embedding API returned an empty or invalid embedding array');
  }
  return data.embedding;
}

async function run(): Promise<void> {
  const rows = await prisma.$queryRaw<{ id: number; description: string }[]>`
    SELECT id, description FROM "EmployeeProject" WHERE embedding IS NULL
  `;

  console.log(`Found ${rows.length} rows with null embeddings`);
  if (rows.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  let processed = 0;
  for (const row of rows) {
    const embedding  = await embedText(row.description);
    const vectorStr  = `[${embedding.join(',')}]`;
    await prisma.$executeRaw`
      UPDATE "EmployeeProject"
      SET    embedding = ${vectorStr}::vector
      WHERE  id        = ${row.id}
    `;
    processed++;
    if (processed % 10 === 0 || processed === rows.length) {
      console.log(`  ${processed}/${rows.length} embedded`);
    }
  }

  console.log(`\nDone — ${processed} embeddings written.`);
}

run()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
