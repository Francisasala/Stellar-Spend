import { isValidQuote } from '@/lib/offramp';
import type { Currency, Institution, GasFeeOptions, FeeMethod, QuoteResult } from './types';

export async function fetchCurrencies(): Promise<Currency[]> {
  const res = await fetch('/api/offramp/currencies');
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchGasFees(): Promise<GasFeeOptions | null> {
  const res = await fetch('/api/offramp/bridge/gas-fee-options');
  if (!res.ok) return null;
  return res.json();
}

export async function fetchInstitutions(currency: string): Promise<Institution[]> {
  const res = await fetch(`/api/offramp/institutions/${encodeURIComponent(currency)}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchQuote(
  amount: string,
  currency: string,
  feeMethod: FeeMethod,
): Promise<QuoteResult> {
  const res = await fetch('/api/offramp/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, currency, feeMethod }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch quote');
  if (!isValidQuote(data)) throw new Error('Invalid quote received');
  return { ...data, currency };
}

export async function verifyAccount(
  institution: string,
  accountNumber: string,
  currency: string,
): Promise<string> {
  const res = await fetch('/api/offramp/verify-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      institution,
      accountIdentifier: accountNumber,
      currency,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Verification failed');
  return data.accountName ?? '';
}
