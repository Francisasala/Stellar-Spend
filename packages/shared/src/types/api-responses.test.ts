import { describe, it, expect } from 'vitest';
import { TradeState, BridgeStatus, PayoutStatus, TransactionStatus } from './api-responses';
import type {
  ApiResponse,
  ApiError,
  PaginationMeta,
  PaginatedResponse,
  TokenInfo,
  CurrencyInfo,
  QuoteRequest,
  QuoteResponse,
  BeneficiaryInfo,
  ExecuteRequest,
  ExecuteResponse,
  TradeStatus,
  BridgeTransferRequest,
  BridgeTransferResponse,
  PayoutOrderRequest,
  PayoutOrderResponse,
  OnChainTransaction,
  ExchangeRate,
  HealthCheckResponse,
  ServiceStatus,
  WalletInfo,
  FeeStructure,
  AvailableCurrencies,
  ErrorResponse,
} from './api-responses';

describe('TradeState enum', () => {
  it('contains all expected values', () => {
    expect(TradeState.PENDING).toBe('PENDING');
    expect(TradeState.BRIDGE_INITIATED).toBe('BRIDGE_INITIATED');
    expect(TradeState.BRIDGE_IN_PROGRESS).toBe('BRIDGE_IN_PROGRESS');
    expect(TradeState.BRIDGE_COMPLETED).toBe('BRIDGE_COMPLETED');
    expect(TradeState.PAYOUT_INITIATED).toBe('PAYOUT_INITIATED');
    expect(TradeState.PAYOUT_IN_PROGRESS).toBe('PAYOUT_IN_PROGRESS');
    expect(TradeState.PAYOUT_COMPLETED).toBe('PAYOUT_COMPLETED');
    expect(TradeState.COMPLETED).toBe('COMPLETED');
    expect(TradeState.FAILED).toBe('FAILED');
    expect(TradeState.CANCELLED).toBe('CANCELLED');
  });
});

describe('BridgeStatus enum', () => {
  it('contains all expected values', () => {
    expect(BridgeStatus.INITIATED).toBe('INITIATED');
    expect(BridgeStatus.IN_PROGRESS).toBe('IN_PROGRESS');
    expect(BridgeStatus.CONFIRMING).toBe('CONFIRMING');
    expect(BridgeStatus.CONFIRMED).toBe('CONFIRMED');
    expect(BridgeStatus.COMPLETED).toBe('COMPLETED');
    expect(BridgeStatus.FAILED).toBe('FAILED');
  });
});

describe('PayoutStatus enum', () => {
  it('contains all expected values', () => {
    expect(PayoutStatus.PENDING).toBe('PENDING');
    expect(PayoutStatus.PROCESSING).toBe('PROCESSING');
    expect(PayoutStatus.SENT).toBe('SENT');
    expect(PayoutStatus.COMPLETED).toBe('COMPLETED');
    expect(PayoutStatus.FAILED).toBe('FAILED');
    expect(PayoutStatus.CANCELLED).toBe('CANCELLED');
  });
});

describe('TransactionStatus enum', () => {
  it('contains all expected values', () => {
    expect(TransactionStatus.PENDING).toBe('PENDING');
    expect(TransactionStatus.SUBMITTED).toBe('SUBMITTED');
    expect(TransactionStatus.CONFIRMING).toBe('CONFIRMING');
    expect(TransactionStatus.CONFIRMED).toBe('CONFIRMED');
    expect(TransactionStatus.FAILED).toBe('FAILED');
    expect(TransactionStatus.CANCELLED).toBe('CANCELLED');
  });
});

describe('ApiResponse type', () => {
  it('accepts data and status', () => {
    const res: ApiResponse<{ id: string }> = { data: { id: 'abc' }, status: 200 };
    expect(res.status).toBe(200);
    expect(res.data?.id).toBe('abc');
  });

  it('accepts error and status', () => {
    const res: ApiResponse<never> = { error: 'not_found', status: 404 };
    expect(res.error).toBe('not_found');
  });
});

describe('ApiError type', () => {
  it('has required fields', () => {
    const err: ApiError = { message: 'Bad request', status: 400 };
    expect(err.message).toBe('Bad request');
    expect(err.status).toBe(400);
  });
});

describe('PaginationMeta type', () => {
  it('has all required fields', () => {
    const meta: PaginationMeta = { page: 1, pageSize: 20, total: 100, totalPages: 5 };
    expect(meta.total).toBe(100);
    expect(meta.totalPages).toBe(5);
  });
});

describe('PaginatedResponse type', () => {
  it('wraps items with pagination', () => {
    const res: PaginatedResponse<string> = {
      items: ['a', 'b'],
      pagination: { page: 1, pageSize: 2, total: 2, totalPages: 1 },
    };
    expect(res.items).toHaveLength(2);
    expect(res.pagination.page).toBe(1);
  });
});

describe('TokenInfo type', () => {
  it('has all required fields', () => {
    const token: TokenInfo = {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 7,
      contract: 'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTQSXUSMIQ75XABZEYYWRB6HP',
      chain: 'STELLAR',
    };
    expect(token.symbol).toBe('USDC');
    expect(token.decimals).toBe(7);
  });
});

describe('CurrencyInfo type', () => {
  it('has all required fields', () => {
    const currency: CurrencyInfo = {
      code: 'NGN',
      name: 'Nigerian Naira',
      symbol: '₦',
      decimals: 2,
      isStablecoin: false,
    };
    expect(currency.code).toBe('NGN');
    expect(currency.isStablecoin).toBe(false);
  });
});

describe('QuoteRequest type', () => {
  it('has all required fields', () => {
    const sourceToken: TokenInfo = {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 7,
      contract: 'GBUQWP3',
      chain: 'STELLAR',
    };
    const destinationToken: TokenInfo = {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      contract: '0xA0b86',
      chain: 'BASE',
    };
    const req: QuoteRequest = {
      sourceToken,
      destinationToken,
      amount: '100',
      isFiatInput: false,
    };
    expect(req.amount).toBe('100');
    expect(req.isFiatInput).toBe(false);
  });
});

describe('QuoteResponse type', () => {
  it('has all required fields', () => {
    const res: QuoteResponse = {
      quoteId: 'q_001',
      sourceAmount: '100',
      destinationAmount: '158200',
      exchangeRate: 1582,
      bridgeFee: '0.50',
      payoutFee: '1.00',
      totalFee: '1.50',
      estimatedTime: 300,
      validUntil: '2025-01-15T10:35:00Z',
    };
    expect(res.quoteId).toBe('q_001');
    expect(res.exchangeRate).toBe(1582);
  });
});

describe('BeneficiaryInfo type', () => {
  it('has all required fields', () => {
    const beneficiary: BeneficiaryInfo = {
      institution: 'GTB',
      accountIdentifier: '0123456789',
      accountName: 'John Doe',
      currency: 'NGN',
    };
    expect(beneficiary.institution).toBe('GTB');
    expect(beneficiary.accountName).toBe('John Doe');
  });
});

describe('ExecuteRequest type', () => {
  it('has all required fields', () => {
    const req: ExecuteRequest = {
      quoteId: 'q_001',
      sourceAddress: 'GBXXXX',
      beneficiary: {
        institution: 'GTB',
        accountIdentifier: '0123456789',
        accountName: 'John Doe',
        currency: 'NGN',
      },
    };
    expect(req.quoteId).toBe('q_001');
  });
});

describe('ExecuteResponse type', () => {
  it('has all required fields', () => {
    const res: ExecuteResponse = {
      tradeId: 'trade_001',
      state: TradeState.PENDING,
    };
    expect(res.tradeId).toBe('trade_001');
    expect(res.state).toBe(TradeState.PENDING);
  });
});

describe('TradeStatus type', () => {
  it('has all required fields', () => {
    const status: TradeStatus = {
      tradeId: 'trade_001',
      state: TradeState.COMPLETED,
      createdAt: '2025-01-15T10:00:00Z',
      updatedAt: '2025-01-15T10:30:00Z',
    };
    expect(status.state).toBe(TradeState.COMPLETED);
    expect(status.tradeId).toBe('trade_001');
  });
});

describe('BridgeTransferRequest type', () => {
  it('has all required fields', () => {
    const sourceToken: TokenInfo = {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 7,
      contract: 'G1',
      chain: 'STELLAR',
    };
    const destinationToken: TokenInfo = {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      contract: '0x1',
      chain: 'BASE',
    };
    const req: BridgeTransferRequest = {
      amount: '100',
      sourceToken,
      destinationToken,
      fromAddress: 'GBXXXX',
      toAddress: '0xAAAA',
    };
    expect(req.amount).toBe('100');
  });
});

describe('BridgeTransferResponse type', () => {
  it('has all required fields', () => {
    const res: BridgeTransferResponse = {
      transferId: 'bridge_001',
      status: BridgeStatus.INITIATED,
      estimatedTime: 120,
      createdAt: '2025-01-15T10:00:00Z',
    };
    expect(res.status).toBe(BridgeStatus.INITIATED);
  });
});

describe('PayoutOrderRequest type', () => {
  it('has all required fields', () => {
    const req: PayoutOrderRequest = {
      amount: 100,
      token: 'USDC',
      network: 'BASE',
      rate: 1582,
      recipient: {
        institution: 'GTB',
        accountIdentifier: '0123456789',
        accountName: 'John Doe',
        currency: 'NGN',
      },
      reference: 'ref_001',
      returnAddress: '0xAAAA',
    };
    expect(req.amount).toBe(100);
    expect(req.reference).toBe('ref_001');
  });
});

describe('PayoutOrderResponse type', () => {
  it('has all required fields', () => {
    const res: PayoutOrderResponse = {
      id: 'payout_001',
      receiveAddress: '0xBBBB',
      amount: '100',
      senderFee: '1.00',
      transactionFee: '0.50',
      validUntil: '2025-01-15T11:00:00Z',
      status: PayoutStatus.PENDING,
    };
    expect(res.id).toBe('payout_001');
    expect(res.status).toBe(PayoutStatus.PENDING);
  });
});

describe('OnChainTransaction type', () => {
  it('has all required fields', () => {
    const tx: OnChainTransaction = {
      id: 'tx_001',
      hash: '0xabc123',
      type: 'payment',
      from: 'GBXXXX',
      amount: '100',
      token: 'USDC',
      status: TransactionStatus.CONFIRMED,
      createdAt: '2025-01-15T10:00:00Z',
    };
    expect(tx.type).toBe('payment');
    expect(tx.status).toBe(TransactionStatus.CONFIRMED);
  });
});

describe('ExchangeRate type', () => {
  it('has all required fields', () => {
    const rate: ExchangeRate = {
      source: 'USDC',
      destination: 'NGN',
      rate: 1582,
      bid: 1580,
      ask: 1584,
      timestamp: '2025-01-15T10:00:00Z',
      source_amount: '1',
      destination_amount: '1582',
    };
    expect(rate.rate).toBe(1582);
    expect(rate.source).toBe('USDC');
  });
});

describe('HealthCheckResponse type', () => {
  it('has all required fields', () => {
    const healthy: ServiceStatus = { status: 'healthy' };
    const res: HealthCheckResponse = {
      status: 'healthy',
      timestamp: '2025-01-15T10:00:00Z',
      services: {
        database: healthy,
        cache: healthy,
        horizon: healthy,
        soroban: healthy,
      },
    };
    expect(res.status).toBe('healthy');
    expect(res.services.database.status).toBe('healthy');
  });
});

describe('WalletInfo type', () => {
  it('has all required fields', () => {
    const wallet: WalletInfo = {
      address: 'GBXXXX',
      publicKey: 'GBXXXX',
      balances: [{ token: 'USDC', amount: '100', native: false }],
      sequenceNumber: '12345',
    };
    expect(wallet.balances).toHaveLength(1);
    expect(wallet.balances[0].token).toBe('USDC');
  });
});

describe('FeeStructure type', () => {
  it('has all required fields', () => {
    const fees: FeeStructure = {
      bridgeFeePercent: 0.5,
      payoutFeePercent: 1.0,
    };
    expect(fees.bridgeFeePercent).toBe(0.5);
    expect(fees.payoutFeePercent).toBe(1.0);
  });
});

describe('AvailableCurrencies type', () => {
  it('has all required fields', () => {
    const available: AvailableCurrencies = {
      fiatCurrencies: [
        { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', decimals: 2, isStablecoin: false },
      ],
      cryptoTokens: [
        { symbol: 'USDC', name: 'USD Coin', decimals: 7, contract: 'G1', chain: 'STELLAR' },
      ],
      supportedPairs: [{ source: 'USDC', destination: 'NGN' }],
    };
    expect(available.fiatCurrencies).toHaveLength(1);
    expect(available.supportedPairs[0].source).toBe('USDC');
  });
});

describe('ErrorResponse type', () => {
  it('has all required fields', () => {
    const err: ErrorResponse = {
      error: { code: 'validation_error', message: 'Invalid input' },
      status: 400,
      timestamp: '2025-01-15T10:00:00Z',
    };
    expect(err.error.code).toBe('validation_error');
    expect(err.status).toBe(400);
  });
});
