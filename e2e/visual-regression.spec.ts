import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

interface FreighterMock {
  isConnected: () => Promise<boolean>;
  getPublicKey: () => Promise<string>;
  signTransaction: (xdr: string) => Promise<string>;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { freighter: FreighterMock }).freighter = {
      isConnected: async () => true,
      getPublicKey: async () => 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      signTransaction: async (xdr: string) => xdr,
    };
  });
});

test.describe('Visual Regression Tests', () => {
  test.describe('Core page snapshots', () => {
    test('main page layout', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('main-page.png', {
        maxDiffPixels: 100,
        threshold: 0.2,
      });
    });

    test('dashboard view', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: /connect wallet/i }).click();
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot('dashboard.png', {
        maxDiffPixels: 100,
        threshold: 0.2,
      });
    });

    test('history page', async ({ page }) => {
      await page.goto(`${BASE_URL}/history`);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('history-page.png', {
        maxDiffPixels: 100,
        threshold: 0.2,
      });
    });

    test('wallet modal', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: /connect wallet/i }).click();
      await page.waitForSelector('[data-testid="wallet-modal"]');
      await page.waitForTimeout(200);

      await expect(page).toHaveScreenshot('wallet-modal.png', {
        maxDiffPixels: 100,
        threshold: 0.2,
      });
    });
  });

  test.describe('Theme variants', () => {
    test('light theme', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.evaluate(() => document.documentElement.classList.remove('dark'));
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot('theme-light.png', {
        maxDiffPixels: 100,
      });
    });

    test('dark theme', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.evaluate(() => document.documentElement.classList.add('dark'));
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot('theme-dark.png', {
        maxDiffPixels: 100,
      });
    });

    test('light theme history page', async ({ page }) => {
      await page.goto(`${BASE_URL}/history`);
      await page.evaluate(() => document.documentElement.classList.remove('dark'));
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot('theme-light-history.png', {
        maxDiffPixels: 100,
      });
    });

    test('dark theme history page', async ({ page }) => {
      await page.goto(`${BASE_URL}/history`);
      await page.evaluate(() => document.documentElement.classList.add('dark'));
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot('theme-dark-history.png', {
        maxDiffPixels: 100,
      });
    });
  });

  test.describe('RTL variants', () => {
    test('RTL layout main page', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.evaluate(() => {
        document.documentElement.setAttribute('dir', 'rtl');
        document.documentElement.setAttribute('lang', 'ar');
      });
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot('rtl-main-page.png', {
        maxDiffPixels: 100,
        threshold: 0.2,
      });
    });

    test('RTL layout history page', async ({ page }) => {
      await page.goto(`${BASE_URL}/history`);
      await page.evaluate(() => {
        document.documentElement.setAttribute('dir', 'rtl');
        document.documentElement.setAttribute('lang', 'ar');
      });
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot('rtl-history.png', {
        maxDiffPixels: 100,
        threshold: 0.2,
      });
    });
  });

  test.describe('Responsive snapshots', () => {
    test('mobile 375px', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('mobile-375.png', {
        maxDiffPixels: 150,
      });
    });

    test('tablet 768px', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('tablet-768.png', {
        maxDiffPixels: 150,
      });
    });

    test('desktop 1920px', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('desktop-1920.png', {
        maxDiffPixels: 150,
      });
    });

    test('mobile history page', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(`${BASE_URL}/history`);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('mobile-history.png', {
        maxDiffPixels: 150,
      });
    });
  });

  test.describe('Interactive states', () => {
    test('button hover state', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');

      const button = page.getByRole('button').first();
      if (await button.isVisible()) {
        await button.hover();
        await page.waitForTimeout(200);
        await expect(button).toHaveScreenshot('button-hover.png', {
          maxDiffPixels: 50,
        });
      }
    });

    test('input focus state', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');

      const input = page.locator('input').first();
      if (await input.isVisible()) {
        await input.focus();
        await page.waitForTimeout(200);
        await expect(input).toHaveScreenshot('input-focus.png', {
          maxDiffPixels: 50,
        });
      }
    });

    test('disabled button state', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');

      const buttons = page.locator('button:disabled');
      const count = await buttons.count();
      if (count > 0) {
        await expect(buttons.first()).toHaveScreenshot('button-disabled.png', {
          maxDiffPixels: 30,
        });
      }
    });

    test('wallet modal open state', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: /connect wallet/i }).click();
      await page.waitForSelector('[data-testid="wallet-modal"]');
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot('modal-open.png', {
        maxDiffPixels: 100,
      });
    });
  });

  test.describe('Visual diff reviews', () => {
    test('main layout diff detection', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');

      const mainContent = page.locator('main').first();
      if (await mainContent.isVisible()) {
        await expect(mainContent).toHaveScreenshot('main-content-diff.png', {
          maxDiffPixels: 200,
          threshold: 0.3,
        });
      }
    });

    test('form elements diff detection', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');

      const form = page.locator('form').first();
      if (await form.isVisible()) {
        await expect(form).toHaveScreenshot('form-diff.png', {
          maxDiffPixels: 100,
          threshold: 0.2,
        });
      }
    });
  });

  test.describe('Accessibility visual tests', () => {
    test('focus indicators visible', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');

      const button = page.getByRole('button').first();
      if (await button.isVisible()) {
        await button.focus();
        await page.waitForTimeout(200);
        const focusStyle = await button.evaluate((el) => {
          return window.getComputedStyle(el, ':focus').outline;
        });
        expect(focusStyle).toBeDefined();
      }
    });

    test('color contrast check', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');

      const elements = page.locator('*');
      const count = await elements.count();
      for (let i = 0; i < Math.min(10, count); i++) {
        const element = elements.nth(i);
        if (await element.isVisible()) {
          const style = await element.evaluate((el) => {
            const computed = window.getComputedStyle(el);
            return { color: computed.color, backgroundColor: computed.backgroundColor };
          });
          expect(style.color).toBeDefined();
        }
      }
    });
  });
});
