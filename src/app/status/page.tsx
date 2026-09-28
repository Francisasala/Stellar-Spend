import { Metadata } from 'next';
import { Suspense } from 'react';
import StatusPage from '@/components/StatusPage';

export const metadata: Metadata = {
  title: 'System Status - Stellar Spend',
  description: 'Real-time system and corridor health status',
};

function StatusSkeleton() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white px-4 py-12">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="h-10 w-48 bg-[#1a1a1a] animate-pulse rounded" />
        <div className="h-24 bg-[#1a1a1a] animate-pulse rounded border border-[#333333]" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-[#1a1a1a] animate-pulse rounded border border-[#333333]" />
          ))}
        </div>
        <div className="h-48 bg-[#1a1a1a] animate-pulse rounded border border-[#333333]" />
      </div>
    </main>
  );
}

export default function Status() {
  return (
    <Suspense fallback={<StatusSkeleton />}>
      <StatusPage />
    </Suspense>
  );
}
