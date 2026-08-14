-- Enable pgvector extension (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to project history rows
ALTER TABLE "EmployeeProject" ADD COLUMN IF NOT EXISTS "embedding" vector(768);

-- HNSW index — cosine distance, optimised for ANN search over 768-dim embeddings
CREATE INDEX IF NOT EXISTS "EmployeeProject_embedding_hnsw_idx"
  ON "EmployeeProject" USING hnsw (embedding vector_cosine_ops);
