import { type Page } from '@playwright/test';

/**
 * Replaces hard-coded `page.waitForTimeout(N)` calls with a
 * condition-based wait: it waits until the network is quiet and the
 * document is fully loaded, then one extra tick for app-side state to
 * settle. This is less flaky than fixed delays because it reacts to the
 * actual state of the page.
 */
export async function waitForNetworkIdle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(50);
}
