export interface InsuranceQuote {
  premium: number;
  coverage: number;
  provider: 'default' | 'premium' | 'enterprise';
  riskScore: number;
  expiresAt: number;
}

export interface InsuranceOptionProps {
  amount: number;
  currency?: string;
  onToggle: (enabled: boolean, quote: InsuranceQuote | null) => void;
  disabled?: boolean;
}

export const PROVIDER_LABELS: Record<string, string> = {
  default: 'Standard',
  premium: 'Premium',
  enterprise: 'Enterprise',
};

export const PROVIDER_DESCRIPTIONS: Record<string, string> = {
  default: 'Basic coverage for everyday transactions',
  premium: 'Enhanced coverage with priority claim processing',
  enterprise: 'Full coverage with dedicated support & bulk discount',
};

export const RISK_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: 'Low Risk', color: 'text-[#4ade80]' },
  medium: { label: 'Medium Risk', color: 'text-[#fbbf24]' },
  high: { label: 'High Risk', color: 'text-[#f87171]' },
};

export function getRiskBand(score: number): 'low' | 'medium' | 'high' {
  if (score < 40) return 'low';
  if (score < 65) return 'medium';
  return 'high';
}

export function formatAmount(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

export function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function calculateQuote(amount: number, currency: string): InsuranceQuote {
  const HIGH_VALUE_THRESHOLD = 10000;
  const BASE_RATE = 0.005;
  const HIGH_VALUE_RATE = 0.003;
  const stablecoins = ['USDC', 'USDT', 'DAI'];

  let riskScore = 50;
  if (amount > HIGH_VALUE_THRESHOLD) riskScore -= 10;
  if (amount < 100) riskScore += 10;
  if (stablecoins.includes(currency.toUpperCase())) riskScore -= 5;
  riskScore = Math.max(0, Math.min(100, riskScore));

  const rate = amount >= HIGH_VALUE_THRESHOLD ? HIGH_VALUE_RATE : BASE_RATE;
  const riskMultiplier = 1 + (riskScore - 50) / 500;
  const premium = parseFloat((amount * rate * riskMultiplier).toFixed(6));
  const coverage = parseFloat((amount * 1.1).toFixed(6));
  const provider =
    amount >= HIGH_VALUE_THRESHOLD ? 'enterprise' : amount >= 1000 ? 'premium' : 'default';

  return {
    premium,
    coverage,
    provider,
    riskScore,
    expiresAt: Date.now() + 15 * 60 * 1000,
  };
}
