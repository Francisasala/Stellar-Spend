'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
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

export default function StatusPage() {
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

  useEffect(() => {
    const interval = setInterval(() => {
      setComponents((prev) => prev.map((c) => ({ ...c, lastCheck: Date.now() })));
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const overallStatus = components.every((c) => c.status === 'operational')
    ? 'operational'
    : components.some((c) => c.status === 'down')
      ? 'down'
      : 'degraded';

  return (
    <main id="main-content" className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-5xl mx-auto px-4 py-12 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">System Status</h1>
          <p className="text-sm text-[#777]">Real-time status and uptime transparency</p>
        </div>

        {/* Overall Status */}
        <div className={cn('border p-6', getStatusColor(overallStatus))}>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-current animate-pulse" />
            <div>
              <div className="text-lg font-semibold">{getStatusText(overallStatus)}</div>
              <div className="text-xs opacity-75">All systems are operating normally</div>
            </div>
          </div>
        </div>

        {/* Uptime */}
        <UptimeSection uptime={uptime} />

        {/* Active Incidents */}
        {incidents.length > 0 && (
          <div className="border border-yellow-400/30 bg-yellow-400/5 p-6 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-yellow-400">
              Active Incidents
            </h2>
            {incidents.map((incident) => (
              <div key={incident.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{incident.title}</div>
                  <div className="text-xs text-[#777]">
                    {formatDateTime(incident.createdAt)}
                  </div>
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
          </div>
        )}

        {/* Components */}
        <ComponentList components={components} />

        {/* Corridors */}
        <CorridorList corridors={corridors} />

        {/* Subscribe */}
        <div className="border border-[#333] bg-[#111] p-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider">Get Updates</h2>
          <p className="text-xs text-[#777]">
            Subscribe to receive notifications about system status and incidents
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="your@email.com"
              className="flex-1 bg-[#0a0a0a] border border-[#333] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#c9a962]"
            />
            <button className="text-[10px] tracking-widest uppercase px-4 py-2 border border-[#c9a962] text-[#c9a962] hover:bg-[#c9a962] hover:text-[#0a0a0a]">
              Subscribe
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-[#555] space-y-1">
          <p>Updated every 30 seconds</p>
          <p>Status powered by Stellar Spend Health Monitoring</p>
        </div>
      </div>
    </main>
  );
}
