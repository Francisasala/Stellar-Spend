import { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'System Status - Stellar Spend',
  description: 'Real-time system and corridor health status',
};

function StatusSkeleton() {
  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-12">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="h-10 w-48 bg-muted animate-pulse rounded" />
        <div className="h-24 bg-muted animate-pulse rounded border border-border" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded border border-border" />
          ))}
        </div>
        <div className="h-48 bg-muted animate-pulse rounded border border-border" />
      </div>
    </main>
  );
}

const StatusPage = dynamic(() => import('@/components/StatusPage'), {
  ssr: false,
  loading: () => <StatusSkeleton />,
});

export default function Status() {
  return <StatusPage />;
}
