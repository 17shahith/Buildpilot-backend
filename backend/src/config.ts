import 'dotenv/config';

const parseOrigins = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

export type AppConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  jwtIssuer: string;
  groqApiKey?: string;
  redisUrl?: string;
  corsOrigins: string[];
};

let cachedConfig: AppConfig | undefined;

export function getConfig(): AppConfig {
  if (cachedConfig) return cachedConfig;

  const nodeEnv = (process.env.NODE_ENV ?? 'development') as AppConfig['nodeEnv'];
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  const port = Number(process.env.PORT ?? 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
    throw new Error('DATABASE_URL must use the PostgreSQL protocol');
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }

  const redisUrl = process.env.REDIS_URL;
  if (nodeEnv === 'production' && !redisUrl) {
    throw new Error('REDIS_URL is required in production');
  }

  const corsOrigins = parseOrigins(process.env.CORS_ORIGINS);
  if (nodeEnv === 'production' && corsOrigins.length === 0) {
    throw new Error('CORS_ORIGINS is required in production');
  }

  cachedConfig = {
    nodeEnv,
    port,
    databaseUrl,
    jwtSecret,
    jwtIssuer: process.env.JWT_ISSUER ?? 'buildbridge-api',
    groqApiKey: process.env.GROQ_API_KEY,
    redisUrl,
    corsOrigins: corsOrigins.length > 0 ? corsOrigins : ['http://localhost:3000', 'http://localhost:5173']
  };
  return cachedConfig;
}
