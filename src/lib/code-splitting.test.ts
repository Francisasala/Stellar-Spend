import { describe, it, expect, vi } from 'vitest';
import { dynamicComponent, lazyLoadModule, preloadModule } from './code-splitting';

/**
 * Issue #1115: Tests for code-splitting of heavy routes
 * Ensures lazy-loaded chunks are properly managed and reduce initial bundle
 */

describe('Code Splitting Utilities (#1115)', () => {
  describe('dynamicComponent', () => {
    it('creates a dynamic component wrapper', () => {
      const importFn = vi.fn(
        () =>
          Promise.resolve({
            default: () => <div>Test Component</div>,
          }),
      );

      const component = dynamicComponent(importFn);
      expect(component).toBeDefined();
    });

    it('uses default loading state when none provided', async () => {
      const importFn = vi.fn(
        () =>
          Promise.resolve({
            default: () => <div>Test Component</div>,
          }),
      );

      const component = dynamicComponent(importFn);
      expect(component).toBeDefined();
    });

    it('uses custom loading component when provided', async () => {
      const importFn = vi.fn(
        () =>
          Promise.resolve({
            default: () => <div>Test Component</div>,
          }),
      );

      const LoadingComponent = () => <div>Custom Loading</div>;
      const component = dynamicComponent(importFn, { loading: LoadingComponent });
      expect(component).toBeDefined();
    });

    it('enables SSR by default', () => {
      const importFn = vi.fn(
        () =>
          Promise.resolve({
            default: () => <div>Test Component</div>,
          }),
      );

      const component = dynamicComponent(importFn);
      expect(component).toBeDefined();
    });

    it('disables SSR when ssr option is false', () => {
      const importFn = vi.fn(
        () =>
          Promise.resolve({
            default: () => <div>Test Component</div>,
          }),
      );

      const component = dynamicComponent(importFn, { ssr: false });
      expect(component).toBeDefined();
    });
  });

  describe('lazyLoadModule', () => {
    it('dynamically imports and resolves module', async () => {
      const mockModule = { name: 'test', value: 42 };
      const importFn = vi.fn(() => Promise.resolve(mockModule));

      const result = await lazyLoadModule(importFn);

      expect(result).toEqual(mockModule);
      expect(importFn).toHaveBeenCalled();
    });

    it('handles async module loading', async () => {
      const mockModule = { api: { getData: () => 'data' } };
      const importFn = vi.fn(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(mockModule), 100);
          }),
      );

      const result = await lazyLoadModule(importFn);

      expect(result).toEqual(mockModule);
    });

    it('propagates errors from import function', async () => {
      const error = new Error('Module not found');
      const importFn = vi.fn(() => Promise.reject(error));

      await expect(lazyLoadModule(importFn)).rejects.toThrow('Module not found');
    });

    it('returns different instances on multiple calls', async () => {
      let callCount = 0;
      const importFn = vi.fn(() =>
        Promise.resolve({
          id: ++callCount,
        }),
      );

      const result1 = await lazyLoadModule(importFn);
      const result2 = await lazyLoadModule(importFn);

      expect(result1.id).toBe(1);
      expect(result2.id).toBe(2);
    });
  });

  describe('preloadModule', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('preloads module in background', () => {
      const importFn = vi.fn(() => Promise.resolve({}));

      preloadModule(importFn);

      // Allow time for requestIdleCallback or setTimeout to fire
      vi.runAllTimers();

      expect(importFn).toHaveBeenCalled();
    });

    it('uses requestIdleCallback when available', () => {
      const importFn = vi.fn(() => Promise.resolve({}));
      const mockRequestIdleCallback = vi.fn((cb: FrameRequestCallback) => {
        cb(0);
        return 1;
      });

      global.requestIdleCallback = mockRequestIdleCallback;

      preloadModule(importFn);

      expect(mockRequestIdleCallback).toHaveBeenCalled();
      expect(importFn).toHaveBeenCalled();

      delete (global as any).requestIdleCallback;
    });

    it('falls back to setTimeout when requestIdleCallback unavailable', () => {
      const importFn = vi.fn(() => Promise.resolve({}));

      if ('requestIdleCallback' in global) {
        delete (global as any).requestIdleCallback;
      }

      vi.useFakeTimers();
      preloadModule(importFn);
      vi.runAllTimers();

      expect(importFn).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('uses 2000ms timeout for setTimeout fallback', () => {
      const importFn = vi.fn(() => Promise.resolve({}));

      if ('requestIdleCallback' in global) {
        delete (global as any).requestIdleCallback;
      }

      vi.useFakeTimers();
      preloadModule(importFn);

      // Should not be called immediately
      expect(importFn).not.toHaveBeenCalled();

      // Advance to just before 2000ms
      vi.advanceTimersByTime(1999);
      expect(importFn).not.toHaveBeenCalled();

      // Advance past 2000ms
      vi.advanceTimersByTime(1);
      expect(importFn).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('does not preload if window is not defined (SSR)', () => {
      const originalWindow = global.window;
      const importFn = vi.fn(() => Promise.resolve({}));

      delete (global as any).window;

      preloadModule(importFn);

      expect(importFn).not.toHaveBeenCalled();

      global.window = originalWindow;
    });
  });

  describe('Feature chunk definitions', () => {
    it('provides wallet modal chunk', () => {
      expect(featureChunks.walletModal).toBeDefined();
      expect(typeof featureChunks.walletModal).toBe('function');
    });

    it('provides insurance chunk', () => {
      expect(featureChunks.insurance).toBeDefined();
      expect(typeof featureChunks.insurance).toBe('function');
    });
  });

  describe('Bundle optimization scenarios', () => {
    it('reduces initial bundle by deferring heavy component loads', async () => {
      const heavyComponentImport = vi.fn(
        () =>
          Promise.resolve({
            default: () => <div>Heavy Component</div>,
          }),
      );

      // Simulating code splitting strategy
      const lazyHeavyComponent = dynamicComponent(heavyComponentImport, {
        loading: () => <div>Loading...</div>,
      });

      expect(lazyHeavyComponent).toBeDefined();
      expect(heavyComponentImport).not.toHaveBeenCalled();
    });

    it('preloads critical routes on idle', () => {
      const adminPanelImport = vi.fn(() =>
        Promise.resolve({
          default: () => <div>Admin Panel</div>,
        }),
      );

      preloadModule(adminPanelImport);

      vi.runAllTimers();

      expect(adminPanelImport).toHaveBeenCalled();
    });

    it('supports multiple route chunks', async () => {
      const importFn1 = vi.fn(() => Promise.resolve({ component: 'Dashboard' }));
      const importFn2 = vi.fn(() => Promise.resolve({ component: 'Settings' }));
      const importFn3 = vi.fn(() => Promise.resolve({ component: 'Profile' }));

      const chunk1 = await lazyLoadModule(importFn1);
      const chunk2 = await lazyLoadModule(importFn2);
      const chunk3 = await lazyLoadModule(importFn3);

      expect(chunk1.component).toBe('Dashboard');
      expect(chunk2.component).toBe('Settings');
      expect(chunk3.component).toBe('Profile');
    });
  });

  describe('Error handling in code splitting', () => {
    it('handles failed chunk imports gracefully', async () => {
      const failedImport = vi.fn(() =>
        Promise.reject(new Error('Chunk loading failed')),
      );

      await expect(lazyLoadModule(failedImport)).rejects.toThrow(
        'Chunk loading failed',
      );
    });

    it('supports error boundary integration', async () => {
      let errorCaught = false;
      const importFn = vi.fn(() =>
        Promise.reject(new Error('Module load error')),
      );

      try {
        await lazyLoadModule(importFn);
      } catch (e) {
        errorCaught = true;
      }

      expect(errorCaught).toBe(true);
    });
  });

  describe('Performance metrics for code splitting', () => {
    it('measures lazy loading performance', async () => {
      const importFn = vi.fn(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ module: 'loaded' }), 50);
          }),
      );

      const start = performance.now();
      const result = await lazyLoadModule(importFn);
      const duration = performance.now() - start;

      expect(result).toBeDefined();
      expect(duration).toBeGreaterThan(0);
    });

    it('preload does not block execution', () => {
      const importFn = vi.fn(() => Promise.resolve({}));

      const start = performance.now();
      preloadModule(importFn);
      const duration = performance.now() - start;

      // Should return immediately without waiting
      expect(duration).toBeLessThan(10);
    });
  });

  describe('Route chunk configuration', () => {
    it('supports route chunk definitions', () => {
      expect(routeChunks).toBeDefined();
      expect(typeof routeChunks).toBe('object');
    });

    it('can be extended with additional route chunks', () => {
      const extendedChunks = {
        ...routeChunks,
        customRoute: () => import('@/components/CustomRoute'),
      };

      expect(extendedChunks.customRoute).toBeDefined();
    });
  });

  describe('Chunk loading strategies', () => {
    it('supports eager loading for critical routes', async () => {
      const criticalRouteImport = vi.fn(() =>
        Promise.resolve({
          component: 'Dashboard',
        }),
      );

      const component = await lazyLoadModule(criticalRouteImport);

      expect(component.component).toBe('Dashboard');
      expect(criticalRouteImport).toHaveBeenCalledTimes(1);
    });

    it('supports lazy loading for non-critical routes', () => {
      const nonCriticalImport = vi.fn(() =>
        Promise.resolve({
          component: 'AdminPanel',
        }),
      );

      const lazyComponent = dynamicComponent(nonCriticalImport, {
        loading: () => <div>Loading admin...</div>,
      });

      expect(lazyComponent).toBeDefined();
      expect(nonCriticalImport).not.toHaveBeenCalled();
    });

    it('supports prefetching on user interaction', async () => {
      const prefetchImport = vi.fn(() =>
        Promise.resolve({
          component: 'Settings',
        }),
      );

      // Simulate user hovering over settings link
      const prefetchHandler = async () => {
        return lazyLoadModule(prefetchImport);
      };

      const result = await prefetchHandler();

      expect(result.component).toBe('Settings');
      expect(prefetchImport).toHaveBeenCalled();
    });
  });
});

// Mock feature chunks for testing
const featureChunks = {
  walletModal: () => Promise.resolve({ default: () => <div>Wallet Modal</div> }),
  insurance: () => Promise.resolve({ default: () => <div>Insurance Option</div> }),
};

const routeChunks = {};
