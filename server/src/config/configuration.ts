export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  llmBaseUrl:     process.env.LLM_BASE_URL,
  llmApiKey:      process.env.LLM_API_KEY,        // optional — omit header when not set
  llmModel:       process.env.LLM_MODEL ?? 'qwen3.5:9b',
  rankingProvider:  process.env.RANKING_PROVIDER ?? 'llm',
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
});
