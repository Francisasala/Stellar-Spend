import type { BaseRepository } from './base';

export interface Transaction {
  id: string;
  timestamp: number;
  finalizedAt?: number;
  userAddress: string;
  amount: string;
  currency: string;
  feeMethod?: string;
  bridgeFee?: string;
  networkFee?: string;
  paycrestFee?: string;
  totalFee?: string;
  stellarTxHash?: string;
  bridgeStatus?: string;
  payoutOrderId?: string;
  payoutStatus?: string;
  beneficiary: {
    institution: string;
    accountIdentifier: string;
    accountName: string;
    currency: string;
  };
  status: 'pending' | 'completed' | 'failed';
  error?: string;
}

export interface TransactionRepository extends BaseRepository<Transaction> {
  getByUser(userAddress: string): Promise<Transaction[]>;
  getByPayoutOrderId(orderId: string): Promise<Transaction | null>;
}

/**
 * Minimal queryable interface compatible with `pg.Pool` / `pg.PoolClient`.
 * Kept narrow so the repository can be unit-tested with a mocked pool.
 */
export interface Queryable {
  query<T = any>(text: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
}

const TABLE = 'transactions';

function rowToTransaction(row: any): Transaction {
  return {
    id: row.id,
    timestamp: Number(row.timestamp),
    finalizedAt:
      row.finalized_at === null || row.finalized_at === undefined
        ? undefined
        : Number(row.finalized_at),
    userAddress: row.user_address,
    amount: row.amount,
    currency: row.currency,
    feeMethod: row.fee_method ?? undefined,
    bridgeFee: row.bridge_fee ?? undefined,
    networkFee: row.network_fee ?? undefined,
    paycrestFee: row.paycrest_fee ?? undefined,
    totalFee: row.total_fee ?? undefined,
    stellarTxHash: row.stellar_tx_hash ?? undefined,
    bridgeStatus: row.bridge_status ?? undefined,
    payoutOrderId: row.payout_order_id ?? undefined,
    payoutStatus: row.payout_status ?? undefined,
    beneficiary: {
      institution: row.beneficiary_institution,
      accountIdentifier: row.beneficiary_account_identifier,
      accountName: row.beneficiary_account_name,
      currency: row.beneficiary_currency,
    },
    status: row.status,
    error: row.error ?? undefined,
  };
}

function transactionToRow(tx: Transaction): Record<string, unknown> {
  return {
    id: tx.id,
    timestamp: tx.timestamp,
    finalized_at: tx.finalizedAt ?? null,
    user_address: tx.userAddress,
    amount: tx.amount,
    currency: tx.currency,
    fee_method: tx.feeMethod ?? null,
    bridge_fee: tx.bridgeFee ?? null,
    network_fee: tx.networkFee ?? null,
    paycrest_fee: tx.paycrestFee ?? null,
    total_fee: tx.totalFee ?? null,
    stellar_tx_hash: tx.stellarTxHash ?? null,
    bridge_status: tx.bridgeStatus ?? null,
    payout_order_id: tx.payoutOrderId ?? null,
    payout_status: tx.payoutStatus ?? null,
    beneficiary_institution: tx.beneficiary.institution,
    beneficiary_account_identifier: tx.beneficiary.accountIdentifier,
    beneficiary_account_name: tx.beneficiary.accountName,
    beneficiary_currency: tx.beneficiary.currency,
    status: tx.status,
    error: tx.error ?? null,
  };
}

/**
 * Database-backed implementation of {@link TransactionRepository}.
 *
 * Wraps the existing DAL queries (save/update/getByUser/getById/getByIds/
 * getByPayoutOrderId) so that services depend on the repository interface
 * instead of calling the DAL directly.
 */
export class DatabaseTransactionRepository implements TransactionRepository {
  constructor(private readonly db: Queryable) {}

  async save(tx: Transaction): Promise<Transaction> {
    const row = transactionToRow(tx);
    const columns = Object.keys(row);
    const placeholders = columns.map((_, i) => `$${i + 1}`);
    const values = columns.map((c) => row[c]);

    const result = await this.db.query(
      `INSERT INTO ${TABLE} (${columns.join(', ')})
       VALUES (${placeholders.join(', ')})
       ON CONFLICT (id) DO UPDATE SET
         ${columns
           .filter((c) => c !== 'id')
           .map((c) => `${c} = EXCLUDED.${c}`)
           .join(', ')}
       RETURNING *`,
      values,
    );

    if (!result.rows || result.rows.length === 0) {
      throw new Error(`Failed to save transaction ${tx.id}`);
    }
    return rowToTransaction(result.rows[0]);
  }

  async update(id: string, patch: Partial<Transaction>): Promise<Transaction | null> {
    const current = await this.getById(id);
    if (!current) {
      return null;
    }

    const merged: Transaction = {
      ...current,
      ...patch,
      beneficiary: {
        ...current.beneficiary,
        ...(patch.beneficiary ?? {}),
      },
    };

    return this.save(merged);
  }

  async getById(id: string): Promise<Transaction | null> {
    const result = await this.db.query(`SELECT * FROM ${TABLE} WHERE id = $1 LIMIT 1`, [id]);
    if (!result.rows || result.rows.length === 0) {
      return null;
    }
    return rowToTransaction(result.rows[0]);
  }

  async getByIds(ids: string[]): Promise<Transaction[]> {
    if (!ids || ids.length === 0) {
      return [];
    }
    const result = await this.db.query(`SELECT * FROM ${TABLE} WHERE id = ANY($1::text[])`, [ids]);
    return (result.rows ?? []).map(rowToTransaction);
  }

  async getByUser(userAddress: string): Promise<Transaction[]> {
    const result = await this.db.query(
      `SELECT * FROM ${TABLE} WHERE user_address = $1 ORDER BY timestamp DESC`,
      [userAddress],
    );
    return (result.rows ?? []).map(rowToTransaction);
  }

  async getByPayoutOrderId(orderId: string): Promise<Transaction | null> {
    const result = await this.db.query(
      `SELECT * FROM ${TABLE} WHERE payout_order_id = $1 LIMIT 1`,
      [orderId],
    );
    if (!result.rows || result.rows.length === 0) {
      return null;
    }
    return rowToTransaction(result.rows[0]);
  }
}
