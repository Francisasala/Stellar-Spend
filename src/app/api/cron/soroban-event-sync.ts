import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { ErrorHandler } from '@/lib/error-handler';
import { SorobanEventIndexer } from '@/lib/stellar';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 60;

const CONTRACT_IDS = [
  process.env.ESCROW_CONTRACT_ID || '',
  process.env.FEE_MANAGER_CONTRACT_ID || '',
].filter(Boolean);

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return ErrorHandler.unauthorized();
    }

    const rpcUrl = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
    const indexer = new SorobanEventIndexer(db, rpcUrl, CONTRACT_IDS);

    const eventCount = await indexer.indexEvents();

    return NextResponse.json({
      success: true,
      eventsIndexed: eventCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Event indexing failed:', {}, error);
    return ErrorHandler.handle(error);
  }
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return ErrorHandler.unauthorized();
    }

    const rpcUrl = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
    const indexer = new SorobanEventIndexer(db, rpcUrl, CONTRACT_IDS);

    const state = await indexer.getIndexerState();

    return NextResponse.json({
      status: 'running',
      lastProcessedLedger: state.lastProcessedLedger,
      lastProcessedAt: state.lastProcessedAt.toISOString(),
    });
  } catch (error) {
    logger.error('State check failed:', {}, error);
    return ErrorHandler.handle(error);
  }
}
