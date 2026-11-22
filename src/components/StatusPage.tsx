'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { useTranslations } from '@/lib/i18n';
import { useStatusPolling } from '@/hooks/useStatusPolling';
import {
  type ComponentStatus,
  type CorridorStatus,
  type Incident,
  getStatusColor,
  getStatusText,
} from './status-page/types';
import { ComponentList } from './status-page/ComponentList';
import { CorridorList } from './status-page/CorridorList';
import { UptimeSection } from './status-page/UptimeSection';
import { formatDateTime } from '@/lib/format';

export * from './status-page/types';

/** Interval (ms) at which component health checks are refreshed. */
export const STATUS_REFRESH_INTERVAL_MS = 30000;

export default function StatusPage() {
  const t = useTranslations('statusPage');
  const [components, setComponents] = useState<ComponentStatus[]>([
    {
      name: 'API',
      status: 'operational',
      lastCheck: Date.now(),
      responseTime: 45,
    },
    {
      name: 'Database',
      status: 'operational',
      lastCheck: Date.now(),
      responseTime: 12,
    },
    {
      name: 'Stellar Network',
      status: 'operational',
      lastCheck: Date.now(),
      responseTime: 230,
    },
    { name: 'Payment Providers', status: 'operational', lastCheck: Date.now() },
  ]);

  const [corridors] = useState<CorridorStatus[]>([
    {
      corridor: 'USDC → NGN',
      provider: 'Paycrest',
      status: 'operational',
      lastTransaction: Date.now() - 120000,
    },
    {
      corridor: 'USDC → KES',
      provider: 'Paycrest',
      status: 'operational',
      lastTransaction: Date.now() - 300000,
    },
    {
      corridor: 'USDC → GHS',
      provider: 'Paycrest',
      status: 'operational',
      lastTransaction: Date.now() - 180000,
    },
    {
      corridor: 'USDC → ZAR',
      provider: 'Paycrest',
      status: 'degraded',
      lastTransaction: Date.now() - 900000,
    },
  ]);

  const [incidents] = useState<Incident[]>([]);

  const [uptime] = useState({
    day: 99.98,
    week: 99.95,
    month: 99.87,
  });

  useStatusPolling({
    onPoll: () => {
      setComponents((prev) => prev.map((c) => ({ ...c, lastCheck: Date.now() })));
    },
    intervalMs: STATUS_REFRESH_INTERVAL_MS,
  });

  const overallStatus = useMemo(
    () =>
      components.every((c) => c.status === 'operational')
        ? 'operational'
        : components.some((c) => c.status === 'down')
          ? 'down'
          : 'degraded',
    [components],
  );

  const formattedIncidents = useMemo(
    () =>
      incidents.map((incident) => ({
        ...incident,
        formattedCreatedAt: formatDateTime(incident.createdAt),
      })),
    [incidents],
  );

  return (
    <main id="main-content" className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-5xl mx-auto px-4 py-12 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-[#777]">{t('subtitle')}</p>
        </div>

        {/* Overall Status */}
        <div
          className={cn('border p-6', getStatusColor(overallStatus))}
          role="status"
          aria-live="polite"
          aria-label={`Overall system status: ${getStatusText(overallStatus)}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-current animate-pulse" aria-hidden="true" />
            <div>
              <div className="text-lg font-semibold">{getStatusText(overallStatus)}</div>
              <div className="text-xs opacity-75">
                {overallStatus === 'operational' ? t('allSystemsNormal') : t('someSystemsAffected')}
              </div>
            </div>
          </div>
        </div>

        {/* Uptime */}
        <UptimeSection uptime={uptime} />

        {/* Active Incidents */}
        {incidents.length > 0 && (
          <section
            className="border border-yellow-400/30 bg-yellow-400/5 p-6 space-y-4"
            aria-labelledby="active-incidents-heading"
          >
            <h2
              id="active-incidents-heading"
              className="text-sm font-semibold uppercase tracking-wider text-yellow-400"
            >
              {t('activeIncidents')}
            </h2>
            {formattedIncidents.map((incident) => (
              <div key={incident.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{incident.title}</div>
                  <div className="text-xs text-[#777]">{incident.formattedCreatedAt}</div>
                </div>
                {incident.updates.map((update, idx) => (
                  <div
                    key={idx}
                    className="text-sm text-[#999] pl-4 border-l-2 border-yellow-400/30"
                  >
                    {update.message}
                  </div>
                ))}
              </div>
            ))}
          </section>
        )}

        {/* Components */}
        <ComponentList components={components} />

        {/* Corridors */}
        <CorridorList corridors={corridors} />

        {/* Subscribe */}
        <section
          className="border border-[#333] bg-[#111] p-6 space-y-3"
          aria-labelledby="subscribe-heading"
        >
          <h2 id="subscribe-heading" className="text-sm font-semibold uppercase tracking-wider">
            {t('getUpdates')}
          </h2>
          <p id="subscribe-description" className="text-xs text-[#777]">
            {t('subscribeDescription')}
          </p>
          <form
            className="flex gap-2"
            aria-describedby="subscribe-description"
            onSubmit={(e) => e.preventDefault()}
          >
            <label htmlFor="status-subscribe-email" className="sr-only">
              {t('emailPlaceholder')}
            </label>
            <input
              id="status-subscribe-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder={t('emailPlaceholder')}
              aria-label={t('emailPlaceholder')}
              className="flex-1 bg-[#0a0a0a] border border-[#333] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#c9a962] focus-visible:ring-2 focus-visible:ring-[#c9a962]"
            />
            <button
              type="submit"
              className="text-[10px] tracking-widest uppercase px-4 py-2 border border-[#c9a962] text-[#c9a962] hover:bg-[#c9a962] hover:text-[#0a0a0a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a962] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111]"
            >
              {t('subscribe')}
            </button>
          </form>
        </section>

        {/* Footer */}
        <footer className="text-center text-xs text-[#555] space-y-1">
          <p>{t('refreshNotice', { seconds: STATUS_REFRESH_INTERVAL_MS / 1000 })}</p>
          <p>{t('poweredBy')}</p>
        </footer>
      </div>
    </main>
  );
}
