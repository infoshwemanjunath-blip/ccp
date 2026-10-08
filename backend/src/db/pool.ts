import pg, { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { env } from '../config/env.js';

// PostgreSQL connection pool optimized for cloud environments (Supabase + Render)
export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl:
    env.NODE_ENV === 'production' || (env.DATABASE_URL && env.DATABASE_URL.includes('supabase.co'))
      ? { rejectUnauthorized: true }
      : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client', err);
});

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error rolling back transaction', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}
