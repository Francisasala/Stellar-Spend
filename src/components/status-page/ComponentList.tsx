import { cn } from '@/lib/cn';
import { type ComponentStatus, getStatusColor, getStatusText, formatTime } from './types';

export interface ComponentListProps {
  components: ComponentStatus[];
}

export function ComponentList({ components }: ComponentListProps) {
  return (
    <div className="border border-[#333] bg-[#111] p-6 space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider">Components</h2>
      <div className="space-y-3">
        {components.map((component) => (
          <div
            key={component.name}
            className="flex items-center justify-between py-2 border-b border-[#222] last:border-0"
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-2 h-2 rounded-full',
                  component.status === 'operational'
                    ? 'bg-green-400'
                    : component.status === 'degraded'
                      ? 'bg-yellow-400'
                      : 'bg-red-400',
                )}
              />
              <span className="text-sm">{component.name}</span>
            </div>
            <div className="flex items-center gap-4">
              {component.responseTime && (
                <span className="text-xs text-[#777]">{component.responseTime}ms</span>
              )}
              <span className="text-xs text-[#555]">{formatTime(component.lastCheck)}</span>
              <span
                className={cn(
                  'text-xs px-2 py-1 rounded border',
                  getStatusColor(component.status),
                )}
              >
                {getStatusText(component.status)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
