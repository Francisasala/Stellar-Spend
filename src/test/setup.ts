import "dotenv/config";
import "@testing-library/jest-dom";

// jsdom does not implement matchMedia, which several components (ThemeContext)
// rely on. Provide a minimal mock so component/hook tests don't crash.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// jsdom only provides requestAnimationFrame when pretendToBeVisual is enabled.
// Some components (ThemeContext.applyTheme) use nested rAF; polyfill if missing.
if (typeof window.requestAnimationFrame !== "function") {
  window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    setTimeout(() => cb(Date.now()), 0) as unknown as number) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = ((id: number) =>
    clearTimeout(id as unknown as NodeJS.Timeout)) as typeof window.cancelAnimationFrame;
}

// Vitest's jsdom environment does not expose localStorage unless a storage file
// is configured. Provide an in-memory implementation so component/hook tests
// (ThemeContext) can use it.
if (typeof globalThis.localStorage === "undefined" || globalThis.localStorage == null) {
  const store = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: localStorageMock,
    configurable: true,
    writable: true,
  });
}
import 'dotenv/config';
import '@testing-library/jest-dom';
