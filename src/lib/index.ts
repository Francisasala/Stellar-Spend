/**
 * Main library barrel export
 * Exports commonly used utilities and services
 */

// Constants — single source of truth for app-wide magic numbers (#1542)
export * from './constants';

// Config
// DI
export * from './di';

// Validators
export * from './validators';

// Services
export * from './services';

// Clients
export * from './clients';

// API client (centralized typed fetch wrapper)
export * from './api/client';

// Utilities
export { logger } from './logger';
export { cn } from './cn';
export * from './error-types';
export * from './error-handler';
export * from './env';
export * from './cors';

// Request validation wrappers
export * from './validation/validate-request';

// Repositories
export * from './repositories';

// Wallets
export * from './wallets';

// Middleware
export * from './middleware';

// Cache
export * from './cache';

// Events
export * from './events';

// Notifications
export * from './notifications';

// Webhook
export * from './webhook';

// API Keys
export * from './api-keys';

// Polling
export * from './polling';

// Stellar
export * from './stellar';

// Database
export * from './db';

// Payroll
export * from './payroll';

// Refund
export * from './refund';

// Onramp
export * from './onramp';
