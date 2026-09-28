import { PoolClient, QueryResult } from 'pg';
import { pool } from './client';

export type TransactionCallback<T> = (client: PoolClient) => Promise<T>;

/**
 * Execute a function within a database transaction.
 * Automatically rolls back on error, commits on success.
 */
export async function withTransaction<T>(callback: TransactionCallback<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Execute multiple queries as a single atomic operation.
 * Returns array of results matching the queries array.
 */
export async function executeAtomic(
  queries: Array<{ text: string; values?: unknown[] }>,
): Promise<QueryResult[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const results: QueryResult[] = [];
    for (const query of queries) {
      const result = await client.query(query.text, query.values);
      results.push(result);
    }
    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
