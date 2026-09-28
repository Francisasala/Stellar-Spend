import { cn } from '@/lib/cn';
import { type CorridorStatus, getStatusColor, getStatusText, formatTime } from './types';

export interface CorridorListProps {
  corridors: CorridorStatus[];
}

export function CorridorList({ corridors }: CorridorListProps) {
  return (
    <div className="border border-[#333] bg-[#111] p-6 space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider">Payment Corridors</h2>
      <div className="space-y-3">
        {corridors.map((corridor) => (
          <div
            key={corridor.corridor}
            className="flex items-center justify-between py-2 border-b border-[#222] last:border-0"
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-2 h-2 rounded-full',
                  corridor.status === 'operational'
                    ? 'bg-green-400'
                    : corridor.status === 'degraded'
                      ? 'bg-yellow-400'
                      : 'bg-red-400',
                )}
              />
              <div>
                <div className="text-sm">{corridor.corridor}</div>
                <div className="text-xs text-[#555]">{corridor.provider}</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-[#555]">
                Last tx: {formatTime(corridor.lastTransaction)}
              </span>
              <span
                className={cn(
                  'text-xs px-2 py-1 rounded border',
                  getStatusColor(corridor.status),
                )}
              >
                {getStatusText(corridor.status)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
