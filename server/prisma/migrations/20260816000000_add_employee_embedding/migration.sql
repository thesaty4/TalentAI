-- Enable pgvector extension (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to Employee (nullable — null until EmbeddingService runs)
-- 768 dimensions matches nomic-embed-text; update if switching models
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "embedding" vector(768);

-- NOTE: IVFFlat index intentionally omitted.
-- Add it only when the table exceeds ~1000 rows: lists = sqrt(row_count).
-- CREATE INDEX employee_embedding_ivfflat_idx ON "Employee" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 32);
