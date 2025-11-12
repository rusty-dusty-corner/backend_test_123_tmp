import fastify from 'fastify';
import { randomUUID } from 'crypto';
import { pool } from './db.js';

async function main() {
  const app = fastify({
    logger: {
      level: 'info',
      transport: { target: 'pino-pretty' },
    },
    genReqId: () => randomUUID(),
  });

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  try {
    await app.listen({ port: 8080, host: '0.0.0.0' });
    app.log.info({ port: 8080 }, 'Server started');
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
