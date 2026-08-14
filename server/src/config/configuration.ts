export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  llamaBaseUrl:     process.env.LLAMA_BASE_URL,
  llamaApiKey:      process.env.LLAMA_API_KEY,        // optional — omit header when not set
  llamaModel:       process.env.LLAMA_MODEL ?? 'llama3',
  rankingProvider:  process.env.RANKING_PROVIDER ?? 'llama',
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
});
