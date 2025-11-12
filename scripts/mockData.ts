import { createHash, randomBytes, randomUUID } from 'crypto';
import bs58 from 'bs58';
import { withClient, pool } from '../src/db.js';

const WORKER_COUNT = 5;
const TOKEN_COUNT = 2;

type SeededToken = {
  protectedToken: string;
  userId: string;
};

function sha256(buffer: Buffer): Buffer {
  return createHash('sha256').update(buffer).digest();
}

function doubleSha256(buffer: Buffer): Buffer {
  return sha256(sha256(buffer));
}

function generateWatcherToken(): { protectedToken: string; payloadHash: Buffer } {
  const payload = randomBytes(16);
  const checksum = doubleSha256(payload).subarray(0, 4);
  const raw = Buffer.concat([payload, checksum]);
  const protectedToken = bs58.encode(raw);
  const payloadHash = sha256(payload);
  return { protectedToken, payloadHash };
}

async function main() {
  const seededTokens = await seedData();
  seededTokens.forEach((item, index) => {
    console.log(`Token #${index + 1}: ${item.protectedToken} (user_id: ${item.userId})`);
  });
  console.log('Seed complete.');
  await pool.end();
}

async function seedData(): Promise<SeededToken[]> {
  const statuses: Array<'online' | 'offline' | 'inactive'> = ['online', 'offline', 'inactive'];
  return withClient(async (client) => {
    await client.query('BEGIN');
    try {
      const userId = randomUUID();
      const seededTokens: SeededToken[] = [];

      for (let i = 0; i < TOKEN_COUNT; i += 1) {
        const { protectedToken, payloadHash } = generateWatcherToken();
        await client.query(
          `
            INSERT INTO watcher_links (user_id, payload_hash, expires_at)
            VALUES ($1::uuid, $2::bytea, NOW() + interval '7 days')
          `,
          [userId, payloadHash],
        );
        seededTokens.push({ protectedToken, userId });
      }

      for (let i = 0; i < WORKER_COUNT; i += 1) {
        const mockStatus = statuses[i % statuses.length];
        const mockHashrateMh = 1;
        await client.query(
          `
            INSERT INTO workers (user_id, name, last_seen_at, hashrate_mh, status)
            VALUES ($1::uuid, $2, NOW() - ($3 || ' minutes')::interval, $4, $5)
          `,
          [
            userId,
            `Rig-${String(i + 1).padStart(2, '0')}`,
            Math.floor(Math.random() * 120),
            mockHashrateMh,
            mockStatus,
          ],
        );
      }

      await client.query('COMMIT');
      return seededTokens;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

main().catch((error) => {
  console.error('Seed failed', error);
  process.exit(1);
});
