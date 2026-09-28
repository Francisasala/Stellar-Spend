export interface ComponentStatus {
  name: string;
  status: 'operational' | 'degraded' | 'down';
  lastCheck: number;
  responseTime?: number;
}

export interface CorridorStatus {
  corridor: string;
  provider: string;
  status: 'operational' | 'degraded' | 'down';
  lastTransaction: number;
}

export interface Incident {
  id: string;
  title: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  createdAt: number;
  updates: {
    message: string;
    timestamp: number;
  }[];
}

export function getStatusColor(status: ComponentStatus['status']): string {
  switch (status) {
    case 'operational':
      return 'text-green-400 bg-green-400/10 border-green-400/30';
    case 'degraded':
      return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
    case 'down':
      return 'text-red-400 bg-red-400/10 border-red-400/30';
  }
}

export function getStatusText(status: ComponentStatus['status']): string {
  switch (status) {
    case 'operational':
      return 'Operational';
    case 'degraded':
      return 'Degraded Performance';
    case 'down':
      return 'Down';
  }
}

export function formatTime(ms: number): string {
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
