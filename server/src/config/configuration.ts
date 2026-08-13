export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-1.5-flash',
  geminiBaseUrl: process.env.GEMINI_BASE_URL,
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
});
