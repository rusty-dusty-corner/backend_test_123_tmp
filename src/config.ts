import 'dotenv/config';

const DEFAULT_PORT = 8080;

export interface AppConfig {
  port: number;
  databaseUrl: string;
  logLevel: string;
  rateLimitPerMinute: number;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadConfig(): AppConfig {
  return {
    port: Number(process.env.PORT ?? DEFAULT_PORT),
    databaseUrl: requireEnv('DATABASE_URL'),
    logLevel: process.env.LOG_LEVEL ?? 'info',
    rateLimitPerMinute: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 30),
  };
}
