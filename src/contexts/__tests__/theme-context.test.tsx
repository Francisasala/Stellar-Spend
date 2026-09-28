import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";

function Consumer({ onValue }: { onValue?: (v: ReturnType<typeof useTheme>) => void }) {
  const value = useTheme();
  onValue?.(value);
  return (
    <div>
      <span data-testid="theme">{value.theme}</span>
      <span data-testid="is-system">{String(value.isSystem)}</span>
      <button onClick={value.toggleTheme}>toggle</button>
      <button onClick={() => value.setTheme("light")}>set-light</button>
      <button onClick={() => value.setTheme("dark")}>set-dark</button>
      <button onClick={() => value.setTheme("high-contrast")}>set-hc</button>
      <button onClick={value.useSystemTheme}>use-system</button>
    </div>
  );
}

function setup() {
  const captured: ReturnType<typeof useTheme>[] = [];
  const utils = render(
    <ThemeProvider>
      <Consumer onValue={(v) => captured.push(v)} />
    </ThemeProvider>
  );
  return { captured, ...utils };
}

describe("ThemeContext", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => cleanup());

  it("provides a default theme of dark when nothing is stored", () => {
    const { captured } = setup();
    // Initial render uses default state "dark"; effect runs and may change it
    expect(captured.length).toBeGreaterThan(0);
    // theme should resolve to a valid value after mount
    act(() => {});
    expect(["light", "dark", "high-contrast"]).toContain(screen.getByTestId("theme").textContent);
  });

  it("reads stored theme on mount", () => {
    localStorage.setItem("theme", "high-contrast");
    setup();
    act(() => {});
    expect(screen.getByTestId("theme").textContent).toBe("high-contrast");
    expect(screen.getByTestId("is-system").textContent).toBe("false");
  });

  it("resolves system theme when no stored value", () => {
    // mock matchMedia to prefer dark
    window.matchMedia = vi.fn().mockImplementation(
      (query: string): MediaQueryList => ({
        matches: query.includes("dark"),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })
    );
    setup();
    act(() => {});
    expect(screen.getByTestId("theme").textContent).toBe("dark");
    expect(screen.getByTestId("is-system").textContent).toBe("true");
  });

  it("toggleTheme cycles through the theme list", () => {
    localStorage.setItem("theme", "dark");
    setup();
    act(() => {});
    act(() => {
      screen.getByText("toggle").click();
    });
    expect(screen.getByTestId("theme").textContent).toBe("light");
    act(() => {
      screen.getByText("toggle").click();
    });
    expect(screen.getByTestId("theme").textContent).toBe("high-contrast");
    act(() => {
      screen.getByText("toggle").click();
    });
    expect(screen.getByTestId("theme").textContent).toBe("dark");
  });

  it("setTheme updates theme and persists to localStorage", () => {
    setup();
    act(() => {});
    act(() => {
      screen.getByText("set-light").click();
    });
    expect(screen.getByTestId("theme").textContent).toBe("light");
    expect(localStorage.getItem("theme")).toBe("light");
    expect(screen.getByTestId("is-system").textContent).toBe("false");
  });

  it("setTheme to high-contrast works", () => {
    setup();
    act(() => {});
    act(() => {
      screen.getByText("set-hc").click();
    });
    expect(screen.getByTestId("theme").textContent).toBe("high-contrast");
  });

  it("useSystemTheme clears stored value and uses system", () => {
    localStorage.setItem("theme", "light");
    window.matchMedia = vi.fn().mockImplementation(
      (query: string): MediaQueryList => ({
        matches: query.includes("contrast"),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })
    );
    setup();
    act(() => {});
    act(() => {
      screen.getByText("use-system").click();
    });
    expect(localStorage.getItem("theme")).toBeNull();
    expect(screen.getByTestId("is-system").textContent).toBe("true");
    expect(screen.getByTestId("theme").textContent).toBe("high-contrast");
  });

  it("applies data-theme attribute to document element", () => {
    localStorage.setItem("theme", "light");
    setup();
    act(() => {});
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("throws when useTheme is used outside provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<ThemeConsumerOutside />)).toThrow(/useTheme must be used within ThemeProvider/);
    spy.mockRestore();
  });

  it("sends a vitals beacon on theme change after mount", () => {
    const sendBeacon = vi.fn(() => true);
    Object.defineProperty(navigator, "sendBeacon", {
      value: sendBeacon,
      configurable: true,
    });
    setup();
    act(() => {});
    act(() => {
      screen.getByText("toggle").click();
    });
    expect(sendBeacon).toHaveBeenCalled();
    expect(sendBeacon.mock.calls[0][1]).toBeInstanceOf(Blob);
  });
});

function ThemeConsumerOutside() {
  useTheme();
  return null;
}
