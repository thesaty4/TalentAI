export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  llmBaseUrl:        process.env.LLM_BASE_URL,
  llmApiKey:         process.env.LLM_API_KEY,       // optional — omit header when not set
  llmModel:          process.env.LLM_MODEL ?? 'qwen3.5:9b',
  rankingProvider:   process.env.RANKING_PROVIDER ?? 'llm',
  // none = disable all vector paths; ollama = use Ollama /api/embed
  embeddingProvider: process.env.EMBEDDING_PROVIDER ?? 'none',
  embeddingBaseUrl:  process.env.EMBEDDING_BASE_URL ?? 'http://localhost:11434',
  embeddingModel:    process.env.EMBEDDING_MODEL ?? 'nomic-embed-text',
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
});
