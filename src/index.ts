import fastify from 'fastify';
import { randomUUID } from 'crypto';
import { pool } from './db.js';
import { loadConfig } from './config.js';
import { TokenRateLimiter } from './rateLimiter.js';
import publicWatcherPlugin from './routes/publicWatcher.js';

async function main() {
  const config = loadConfig();

  const app = fastify({
    logger: {
      level: config.logLevel,
      transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
    },
    genReqId: () => randomUUID(),
  });

  const rateLimiter = new TokenRateLimiter(config.rateLimitPerMinute, 60_000);

  app.addHook('onRequest', async (request, reply) => {
    request.log.info(
      { request_id: request.id, method: request.method, url: request.url },
      'Incoming request',
    );
    reply.header('X-Request-Id', request.id);
  });

  app.addHook('onResponse', async (request, reply) => {
    request.log.info(
      {
        request_id: request.id,
        statusCode: reply.statusCode,
      },
      'Completed request',
    );
  });

  app.get('/health', async () => {
    await pool.query('SELECT 1');
    return { status: 'ok' };
  });

  await app.register(publicWatcherPlugin, {
    rateLimiter,
  });

  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    app.log.info({ port: config.port }, 'Server started');
  } catch (error) {
    app.log.error({ err: error }, 'Failed to start server');
    await app.close();
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error', error);
  process.exit(1);
});
