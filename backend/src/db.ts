import pg from 'pg';
import type { ClientConfig, PoolClient } from 'pg';
import { env } from './config.js';

function sslConfig(): ClientConfig['ssl'] {
  if (env.DATABASE_SSL === 'disable') return false;
  if (env.DATABASE_SSL === 'require') return { rejectUnauthorized: false };
  return { rejectUnauthorized: true, ...(env.DATABASE_CA_CERT ? { ca: env.DATABASE_CA_CERT } : {}) };
}

export const pool = new pg.Pool({ connectionString: env.DATABASE_URL, ssl: sslConfig(), max: 10 });

/** Runs fn inside a transaction; commits on success, rolls back on any error. */
export async function tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === '23505';
}
