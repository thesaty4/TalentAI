export type RankingProvider = 'llama' | 'heuristic';

export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  // Llama / Ollama gateway — RANKING_PROVIDER switches active ranking path
  llamaBaseUrl:    process.env.LLAMA_BASE_URL    ?? 'http://localhost:11434',
  llamaApiKey:     process.env.LLAMA_API_KEY,
  llamaModel:      process.env.LLAMA_MODEL        ?? 'llama3',
  llamaEmbedModel: process.env.LLAMA_EMBED_MODEL  ?? 'nomic-embed-text',
  rankingProvider: (process.env.RANKING_PROVIDER  ?? 'llama') as RankingProvider,
});
