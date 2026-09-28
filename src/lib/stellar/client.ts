/**
 * Unified Stellar RPC client with resilience patterns.
 * Consolidates all Stellar SDK and RPC operations behind a single interface.
 */

import { logger } from '@/lib/logger';
import {
  Horizon,
  Transaction,
  Networks,
  TransactionBuilder,
  Account,
  Keypair,
  Operation,
  Asset,
  Memo,
  BASE_FEE,
} from '@stellar/stellar-sdk';

/**
 * Configuration for retry and backoff behavior.
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Default retry configuration.
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
};

/**
 * Represents a transaction response from Stellar Horizon.
 */
export interface TransactionResponse {
  id: string;
  hash: string;
  status: 'success' | 'failed' | 'pending';
  ledger?: number;
}

/**
 * Represents an account from Stellar Horizon.
 */
export interface AccountResponse {
  id: string;
  accountId: string;
  balances: Array<{
    balance: string;
    assetType: string;
    assetCode?: string;
    assetIssuer?: string;
  }>;
  sequenceNumber: string;
}

/**
 * Unified Stellar RPC client with resilience patterns.
 */
export class StellarClient {
  private horizon: Horizon.Server;
  private rpcUrl: string;
  private networkPassphrase: string;
  private retryConfig: RetryConfig;

  constructor(
    horizonUrl: string,
    rpcUrl: string,
    networkPassphrase: string = Networks.PUBLIC_NETWORK,
    retryConfig: Partial<RetryConfig> = {},
  ) {
    this.horizon = new Horizon.Server(horizonUrl, { allowHttp: false });
    this.rpcUrl = rpcUrl;
    this.networkPassphrase = networkPassphrase;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  /**
   * Submits a transaction to the Stellar network with retry logic.
   */
  async submitTransaction(
    transaction: Transaction,
  ): Promise<TransactionResponse> {
    return this.withRetry(async () => {
      try {
        const result = await this.horizon.submitTransaction(transaction);
        return {
          id: result.id,
          hash: result.hash,
          status: result.successful ? 'success' : 'failed',
          ledger: result.ledger,
        };
      } catch (error) {
        this.logError('submitTransaction', error);
        throw error;
      }
    });
  }

  /**
   * Fetches account information from Stellar Horizon with retry logic.
   */
  async getAccount(accountId: string): Promise<AccountResponse> {
    return this.withRetry(async () => {
      try {
        const account = await this.horizon.accounts().accountId(accountId).call();
        return {
          id: account.id,
          accountId: account.account_id,
          balances: account.balances.map((b: any) => ({
            balance: b.balance,
            assetType: b.asset_type,
            assetCode: b.asset_code,
            assetIssuer: b.asset_issuer,
          })),
          sequenceNumber: account.sequence,
        };
      } catch (error) {
        this.logError('getAccount', error);
        throw error;
      }
    });
  }

  /**
   * Fetches the current sequence number for an account.
   */
  async getSequenceNumber(accountId: string): Promise<string> {
    const account = await this.getAccount(accountId);
    return account.sequenceNumber;
  }

  /**
   * Fetches transaction details from Stellar Horizon with retry logic.
   */
  async getTransaction(transactionHash: string): Promise<any> {
    return this.withRetry(async () => {
      try {
        return await this.horizon.transactions().transaction(transactionHash).call();
      } catch (error) {
        this.logError('getTransaction', error);
        throw error;
      }
    });
  }

  /**
   * Fetches operation details with retry logic.
   */
  async getOperation(operationId: string): Promise<any> {
    return this.withRetry(async () => {
      try {
        return await this.horizon.operations().operation(operationId).call();
      } catch (error) {
        this.logError('getOperation', error);
        throw error;
      }
    });
  }

  /**
   * Builds a payment transaction.
   */
  buildPaymentTransaction(
    sourceAccount: Account,
    destination: string,
    asset: Asset | 'native',
    amount: string,
    memo?: Memo,
    baseFee: number = BASE_FEE,
  ): Transaction {
    try {
      let builder = new TransactionBuilder(sourceAccount, {
        fee: baseFee,
        networkPassphrase: this.networkPassphrase,
      });

      if (memo) {
        builder = builder.addMemo(memo);
      }

      const actualAsset = asset === 'native' ? Asset.native() : asset;

      return builder
        .addOperation(
          Operation.payment({
            destination,
            asset: actualAsset,
            amount,
          }),
        )
        .setTimeout(30)
        .build();
    } catch (error) {
      this.logError('buildPaymentTransaction', error);
      throw error;
    }
  }

  /**
   * Simulates a transaction on Soroban RPC with retry logic.
   */
  async simulateTransaction(transactionXdr: string): Promise<any> {
    return this.withRetry(async () => {
      try {
        const response = await fetch(`${this.rpcUrl}/simulateTransaction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: '1',
            method: 'simulateTransaction',
            params: [transactionXdr],
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        this.logError('simulateTransaction', error);
        throw error;
      }
    });
  }

  /**
   * Sends a raw RPC request to Soroban with retry logic.
   */
  async sendRpcRequest(method: string, params: unknown[]): Promise<any> {
    return this.withRetry(async () => {
      try {
        const response = await fetch(this.rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: '1',
            method,
            params,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        this.logError(`sendRpcRequest[${method}]`, error);
        throw error;
      }
    });
  }

  /**
   * Executes an async operation with exponential backoff retry logic.
   * Retries on network errors and transient failures.
   */
  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          throw lastError;
        }

        // Don't retry on the last attempt
        if (attempt === this.retryConfig.maxAttempts) {
          break;
        }

        // Calculate backoff delay
        const delayMs = this.calculateBackoffDelay(attempt);
        logger.warn(
          `Stellar RPC call failed (attempt ${attempt}/${this.retryConfig.maxAttempts}), retrying in ${delayMs}ms`,
          { error: lastError.message },
        );

        // Wait before retrying
        await this.sleep(delayMs);
      }
    }

    throw lastError || new Error('Unknown error in Stellar RPC call');
  }

  /**
   * Determines if an error is retryable.
   */
  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    const message = error.message.toLowerCase();

    // Network errors
    if (message.includes('econnrefused') || message.includes('enotfound')) return true;
    if (message.includes('timeout') || message.includes('timed out')) return true;
    if (message.includes('network')) return true;

    // HTTP errors
    if (message.includes('503') || message.includes('502') || message.includes('500')) return true;
    if (message.includes('rate limit')) return true;
    if (message.includes('temporarily unavailable')) return true;

    // Stellar-specific transient errors
    if (message.includes('connection refused')) return true;
    if (message.includes('concurrent requests')) return true;

    return false;
  }

  /**
   * Calculates exponential backoff delay.
   */
  private calculateBackoffDelay(attempt: number): number {
    const exponentialDelay =
      this.retryConfig.initialDelayMs * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, this.retryConfig.maxDelayMs);
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * cappedDelay;
    return Math.floor(cappedDelay + jitter);
  }

  /**
   * Sleeps for a given number of milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Logs an error with context.
   */
  private logError(operation: string, error: unknown): void {
    if (error instanceof Error) {
      logger.error(`StellarClient.${operation} failed`, { error: error.message });
    } else {
      logger.error(`StellarClient.${operation} failed`, {});
    }
  }

  /**
   * Health check for the Stellar network connection.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.withRetry(async () => {
        return await this.horizon.root();
      });
      return !!result;
    } catch {
      return false;
    }
  }
}

/**
 * Singleton instance of StellarClient.
 */
let _stellarClient: StellarClient | null = null;

/**
 * Gets or creates the singleton StellarClient instance.
 */
export function getStellarClient(): StellarClient {
  if (!_stellarClient) {
    const horizonUrl = process.env.STELLAR_HORIZON_URL || 'https://horizon.stellar.org';
    const rpcUrl = process.env.STELLAR_RPC_URL || 'https://soroban-rpc.stellar.org';
    _stellarClient = new StellarClient(horizonUrl, rpcUrl);
  }
  return _stellarClient;
}

/**
 * Resets the singleton instance (for testing).
 */
export function _resetStellarClient(): void {
  _stellarClient = null;
}
