// LLM context window fits ~35-100 candidates comfortably with full project history
export const MAX_RANKING_CANDIDATES      = 100;
// JD text is capped before insertion into the prompt to keep context tight
export const JD_TEXT_MAX_LENGTH          = 4000;
// pgvector RAG: max candidates passed to LLM after vector pre-filter
export const VECTOR_PRE_FILTER_LIMIT     = 35;
// Must match the embedding model output — nomic-embed-text=768, mxbai-embed-large=1024, text-embedding-3-small=1536
export const EMBEDDING_DIMENSIONS        = 768;
// Minimum vector-filtered intersection before falling back to full pool
export const MIN_VECTOR_RESULTS          = 5;
