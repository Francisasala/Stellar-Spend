'use client';

import { useState, useCallback, memo } from 'react';
import { useDashboardWallet } from '@/hooks/useDashboardWallet';
import { useWebVitals } from '@/hooks/useWebVitals';
import { useTranslations } from '@/lib/i18n';
import {
  DashboardHeaderSection,
  OfframpFormSection,
  RightPanelSection,
  useDashboardState,
} from '@/features/dashboard';

/** Simulated submission latency (ms) for the off-ramp flow. */
const SUBMIT_DELAY_MS = 2000;

/** Placeholder balances shown while connected (demo data). */
const DEMO_USDC_BALANCE = '1,234.56';
const DEMO_XLM_BALANCE = '567.89';

/**
 * DashboardClient - Client Component
 * Thin composition shell that wires wallet state and dashboard feature modules.
 * Separated to allow server-rendered static content in main page
 */

function DashboardClient() {
  // Track Web Vitals
  useWebVitals();

  const t = useTranslations('dashboard');

  const { isConnected, isConnecting, walletAddress, resetKey, handleConnect, handleDisconnect } =
    useDashboardWallet();

  const { handleSubmit, handleQuoteChange, handleAmountChange, handleCurrencyChange } =
    useDashboardState();

  return (
    <>
      <DashboardHeaderSection
        subtitle={t('subtitle')}
        isConnected={isConnected}
        isConnecting={isConnecting}
        walletAddress={walletAddress}
        stellarUsdcBalance={isConnected ? DEMO_USDC_BALANCE : null}
        stellarXlmBalance={isConnected ? DEMO_XLM_BALANCE : null}
        isBalanceLoading={false}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.7fr)]">
        <OfframpFormSection
          isConnected={isConnected}
          isConnecting={isConnecting}
          resetKey={resetKey}
          onConnect={handleConnect}
          onSubmit={handleSubmit}
          onQuoteChange={handleQuoteChange}
          onAmountChange={handleAmountChange}
          onCurrencyChange={handleCurrencyChange}
        />
        <RightPanelSection />
      </section>
    </>
  );
}

export default memo(DashboardClient);
