/**
 * Barrel for the domain-split GraphQL resolver modules.
 *
 * Usage:
 *   import { resolvers, subscriptions } from '@/lib/graphql';
 *
 * Domains:
 *   - transactions  → queries/subscriptions for transactions, quotes, currencies, rates
 *   - accounts      → queries/mutations for KYC and user limits
 *   - merchant      → queries/mutations for compliance screening & analytics
 *   - webhooks      → queries/mutations for webhook deliveries, DLQ, and disputes
 */

export { transactionQueries, transactionSubscriptions } from './transactions';
export { accountQueries, accountMutations } from './accounts';
export { merchantQueries, merchantMutations, merchantSubscriptions } from './merchant';
export { webhookQueries, webhookMutations, webhookSubscriptions } from './webhooks';
export {
  getResolverUsageReport,
  getUnusedResolvers,
  type ResolverUsageRecord,
} from '../resolver-usage';

import { transactionQueries, transactionSubscriptions } from './transactions';
import { accountQueries, accountMutations } from './accounts';
import { merchantQueries, merchantMutations, merchantSubscriptions } from './merchant';
import { webhookQueries, webhookMutations, webhookSubscriptions } from './webhooks';
import { withUsageTracking } from '../resolver-usage';

/**
 * Combined resolver map passed as `rootValue` to the `graphql()` executor.
 * Every field is wrapped with usage tracking (see resolver-usage.ts) so
 * fields no client ever queries surface in getUnusedResolvers() instead of
 * being guessed at from a static read of the schema.
 */
export const resolvers = {
  Query: withUsageTracking('Query', {
    ...transactionQueries,
    ...accountQueries,
    ...merchantQueries,
    ...webhookQueries,
  }),
  Mutation: withUsageTracking('Mutation', {
    ...accountMutations,
    ...merchantMutations,
    ...webhookMutations,
  }),
};

/**
 * Subscription resolver map.
 */
export const subscriptions = withUsageTracking('Subscription', {
  ...transactionSubscriptions,
  ...merchantSubscriptions,
  ...webhookSubscriptions,
});
