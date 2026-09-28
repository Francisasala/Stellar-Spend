import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { withTransaction, executeAtomic } from './transaction';
import { pool } from './client';

describe('Database Transaction Wrapper', () => {
  beforeAll(async () => {
    // Create test table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transaction_test (
        id SERIAL PRIMARY KEY,
        value VARCHAR(255),
        created_at BIGINT
      )
    `);
  });

  afterAll(async () => {
    // Cleanup
    await pool.query('DROP TABLE IF EXISTS transaction_test');
  });

  it('should commit transaction on success', async () => {
    const result = await withTransaction(async (client) => {
      const res = await client.query(
        'INSERT INTO transaction_test (value, created_at) VALUES ($1, $2) RETURNING *',
        ['success_test', Date.now()],
      );
      return res.rows[0];
    });

    expect(result.value).toBe('success_test');

    // Verify data persisted
    const check = await pool.query('SELECT * FROM transaction_test WHERE value = $1', [
      'success_test',
    ]);
    expect(check.rows.length).toBe(1);
  });

  it('should rollback transaction on error', async () => {
    try {
      await withTransaction(async (client) => {
        await client.query(
          'INSERT INTO transaction_test (value, created_at) VALUES ($1, $2)',
          ['rollback_test', Date.now()],
        );
        throw new Error('Intentional test error');
      });
    } catch {
      // Expected error
    }

    // Verify data was rolled back
    const check = await pool.query('SELECT * FROM transaction_test WHERE value = $1', [
      'rollback_test',
    ]);
    expect(check.rows.length).toBe(0);
  });

  it('should execute multiple queries atomically', async () => {
    const now = Date.now();
    const results = await executeAtomic([
      {
        text: 'INSERT INTO transaction_test (value, created_at) VALUES ($1, $2)',
        values: ['atomic_1', now],
      },
      {
        text: 'INSERT INTO transaction_test (value, created_at) VALUES ($1, $2)',
        values: ['atomic_2', now],
      },
    ]);

    expect(results.length).toBe(2);

    // Verify both records exist
    const check = await pool.query('SELECT * FROM transaction_test WHERE value LIKE $1', [
      'atomic_%',
    ]);
    expect(check.rows.length).toBe(2);
  });

  it('should rollback all queries on partial failure', async () => {
    const now = Date.now();
    try {
      await executeAtomic([
        {
          text: 'INSERT INTO transaction_test (value, created_at) VALUES ($1, $2)',
          values: ['partial_success', now],
        },
        {
          text: 'INSERT INTO transaction_test (value, created_at, nonexistent) VALUES ($1, $2, $3)',
          values: ['partial_fail', now, 'invalid'],
        },
      ]);
    } catch {
      // Expected error
    }

    // Verify first insert was rolled back
    const check = await pool.query('SELECT * FROM transaction_test WHERE value = $1', [
      'partial_success',
    ]);
    expect(check.rows.length).toBe(0);
  });
});
