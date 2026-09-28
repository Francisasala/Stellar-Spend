export type EventType =
  | 'transaction.created'
  | 'transaction.completed'
  | 'transaction.failed'
  | 'bridge.initiated'
  | 'bridge.completed'
  | 'payout.initiated'
  | 'payout.completed'
  | 'payout.failed'
  | 'error.occurred';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Event<T = any> {
  type: EventType;
  timestamp: number;
  data: T;
  id: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventHandler<T = any> = (event: Event<T>) => Promise<void> | void;

export interface EventBusConfig {
  maxListeners?: number;
  logEvents?: boolean;
}
