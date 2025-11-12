import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { loadConfig } from './config.js';

const config = loadConfig();

export const pool = new Pool({
  connectionString: config.databaseUrl,
});

export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}
