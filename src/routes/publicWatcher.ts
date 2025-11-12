import fp from 'fastify-plugin';
import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import Big from 'big.js';
import { query } from '../db.js';
import { TokenRateLimiter } from '../rateLimiter.js';
import { TokenValidationError, validateAndParseToken } from '../token.js';
import { computeEtag } from '../etag.js';
import { normalizeForEtag } from '../time.js';

type PublicWatcherParams = {
  token: string;
};

type WorkerRow = {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'inactive';
  last_seen_at: string;
  hashrate_mh: string;
};

type WatcherLinkRow = {
  user_id: string;
  scope: string;
  expires_at: string;
  revoked_at: string | null;
};

type WorkerResponse = {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'inactive';
  last_seen_at: string;
  hashrate_th: string;
};

type AggResponse = {
  online: number;
  offline: number;
  inactive: number;
  total_hashrate_th: string;
};

type PublicWatcherResponse = {
  workers: WorkerResponse[];
  agg: AggResponse;
};

export interface PublicWatcherPluginOptions {
  rateLimiter: TokenRateLimiter;
}

const plugin: FastifyPluginAsync<PublicWatcherPluginOptions> = async (fastify, options) => {
  fastify.get<{
    Params: PublicWatcherParams;
  }>('/public/w/:token/dashboard', async (request, reply) => {
    return handleRequest(fastify, request, reply, options.rateLimiter);
  });
};

async function handleRequest(
  fastify: FastifyInstance,
  request: FastifyRequest<{ Params: PublicWatcherParams }>,
  reply: FastifyReply,
  rateLimiter: TokenRateLimiter,
) {
  const token = request.params.token;
  let payloadHash: Buffer;

  try {
    const result = validateAndParseToken(token);
    payloadHash = result.payloadHash;
  } catch (error) {
    if (error instanceof TokenValidationError) {
      fastify.log.info({ token }, 'Invalid watcher token');
      return reply.status(404).send();
    }
    fastify.log.error({ err: error }, 'Unexpected token validation failure');
    return reply.status(500).send();
  }

  const limiterKey = payloadHash.toString('hex');
  if (!rateLimiter.consume(limiterKey)) {
    return reply.status(429).send({
      error: 'rate_limited',
      message: 'Too many requests for this token',
    });
  }

  const link = await findValidWatcherLink(payloadHash);
  if (!link) {
    return reply.status(404).send();
  }

  const workers = await findWorkers(link.user_id);
  const responseBody = buildResponse(workers);
  const etag = buildEtag(responseBody);
  const ifNoneMatch = request.headers['if-none-match'];

  reply.header('ETag', etag);
  if (ifNoneMatch === etag) {
    return reply.status(304).send();
  }

  return reply.status(200).send(responseBody);
}

async function findValidWatcherLink(payloadHash: Buffer): Promise<WatcherLinkRow | null> {
  const result = await query<WatcherLinkRow>(
    `
      SELECT user_id, scope, expires_at, revoked_at
      FROM watcher_links
      WHERE payload_hash = $1
      LIMIT 1
    `,
    [payloadHash],
  );

  if (result.rowCount === 0) {
    return null;
  }

  const link = result.rows[0];
  if (link.scope !== 'dashboard') {
    return null;
  }

  const now = new Date();
  if (new Date(link.expires_at) <= now) {
    return null;
  }

  if (link.revoked_at && new Date(link.revoked_at) <= now) {
    return null;
  }

  return link;
}

async function findWorkers(userId: string): Promise<WorkerRow[]> {
  const result = await query<WorkerRow>(
    `
      SELECT
        id::text,
        name,
        status,
        last_seen_at,
        hashrate_mh::text
      FROM workers
      WHERE user_id = $1
      ORDER BY hashrate_mh DESC, name ASC, id ASC
    `,
    [userId],
  );

  return result.rows;
}

function toTerahashString(hashrateMh: string): string {
  const value = new Big(hashrateMh);
  const terahash = value.div(1_000_000);
  return terahash.toFixed(3);
}

function buildResponse(workers: WorkerRow[]): PublicWatcherResponse {
  const agg: AggResponse = {
    online: 0,
    offline: 0,
    inactive: 0,
    total_hashrate_th: '0.000',
  };

  let totalHashrate = new Big(0);

  const workerResponses: WorkerResponse[] = workers.map((worker) => {
    const hashrateTh = toTerahashString(worker.hashrate_mh);
    totalHashrate = totalHashrate.plus(new Big(worker.hashrate_mh).div(1_000_000));
    agg[worker.status] += 1;

    const lastSeenIso = new Date(worker.last_seen_at).toISOString();

    return {
      id: worker.id,
      name: worker.name,
      status: worker.status,
      last_seen_at: lastSeenIso,
      hashrate_th: hashrateTh,
    };
  });

  agg.total_hashrate_th = totalHashrate.toFixed(3);

  return {
    workers: workerResponses,
    agg,
  };
}

function buildEtag(response: PublicWatcherResponse): string {
  const normalizedWorkers = response.workers.map((worker) => ({
    ...worker,
    last_seen_at: normalizeForEtag(worker.last_seen_at),
  }));

  const subject = {
    workers: normalizedWorkers,
    agg: response.agg,
  };

  return computeEtag(subject);
}

export default fp(plugin, {
  name: 'public-watcher-route',
});
