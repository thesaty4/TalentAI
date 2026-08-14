"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const dotenv = require("dotenv");
dotenv.config();
const prisma = new client_1.PrismaClient();
const BASE_URL = process.env.LLAMA_BASE_URL ?? 'http://localhost:11434';
const API_KEY = process.env.LLAMA_API_KEY;
const EMBED_MODEL = process.env.LLAMA_EMBED_MODEL ?? 'nomic-embed-text';
async function embedText(text) {
    let res;
    try {
        res = await fetch(`${BASE_URL}/api/embeddings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
            },
            body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
        });
    }
    catch (err) {
        const msg = err.message ?? '';
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
    const data = (await res.json());
    if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
        throw new Error('Embedding API returned an empty or invalid embedding array');
    }
    return data.embedding;
}
async function run() {
    const rows = await prisma.$queryRaw `
    SELECT id, description FROM "EmployeeProject" WHERE embedding IS NULL
  `;
    console.log(`Found ${rows.length} rows with null embeddings`);
    if (rows.length === 0) {
        console.log('Nothing to do.');
        return;
    }
    let processed = 0;
    for (const row of rows) {
        const embedding = await embedText(row.description);
        const vectorStr = `[${embedding.join(',')}]`;
        await prisma.$executeRaw `
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
//# sourceMappingURL=generate-embeddings.js.map