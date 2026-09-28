import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import {
  ToastProvider,
  useToasts,
  useToastActions,
  useToast,
} from "@/contexts/ToastContext";

function ToastConsumer() {
  const toasts = useToasts();
  const { showToast, removeToast } = useToastActions();
  return (
    <div>
      <span data-testid="count">{String(toasts.length)}</span>
      <ul>
        {toasts.map((t) => (
          <li key={t.id} data-testid="toast">
            {t.message}:{t.type}
            <button onClick={() => removeToast(t.id)}>remove</button>
          </li>
        ))}
      </ul>
      <button onClick={() => showToast("hello")}>show-default</button>
      <button onClick={() => showToast("saved", "success")}>show-success</button>
      <button onClick={() => showToast("oops", "error")}>show-error</button>
      <button onClick={() => showToast("info msg", "info")}>show-info</button>
      <button onClick={() => showToast("warn", "warning")}>show-warning</button>
    </div>
  );
}

describe("ToastContext", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("starts with empty toast list", () => {
    render(
      <ToastProvider>
        <ToastConsumer />
      </ToastProvider>
    );
    expect(screen.getByTestId("count").textContent).toBe("0");
  });

  it("showToast adds a toast with default type info", () => {
    render(
      <ToastProvider>
        <ToastConsumer />
      </ToastProvider>
    );
    act(() => {
      screen.getByText("show-default").click();
    });
    expect(screen.getByTestId("count").textContent).toBe("1");
    expect(screen.getByTestId("toast").textContent).toContain("hello:info");
  });

  it("showToast respects explicit type", () => {
    render(
      <ToastProvider>
        <ToastConsumer />
      </ToastProvider>
    );
    act(() => {
      screen.getByText("show-success").click();
    });
    expect(screen.getByTestId("toast").textContent).toContain("saved:success");
  });

  it("adds multiple toasts without replacing", () => {
    render(
      <ToastProvider>
        <ToastConsumer />
      </ToastProvider>
    );
    act(() => {
      screen.getByText("show-default").click();
    });
    act(() => {
      screen.getByText("show-error").click();
    });
    expect(screen.getByTestId("count").textContent).toBe("2");
  });

  it("removeToast removes specific toast by id", () => {
    render(
      <ToastProvider>
        <ToastConsumer />
      </ToastProvider>
    );
    act(() => {
      screen.getByText("show-default").click();
    });
    act(() => {
      screen.getByText("show-success").click();
    });
    expect(screen.getByTestId("count").textContent).toBe("2");
    act(() => {
      screen.getAllByText("remove")[0].click();
    });
    expect(screen.getByTestId("count").textContent).toBe("1");
  });

  it("auto-dismisses toast after timeout", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ToastConsumer />
      </ToastProvider>
    );
    act(() => {
      screen.getByText("show-default").click();
    });
    expect(screen.getByTestId("count").textContent).toBe("1");
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByTestId("count").textContent).toBe("0");
    vi.useRealTimers();
  });

  it("useToast returns combined toasts and actions", () => {
    let captured: ReturnType<typeof useToast> | null = null;
    function Probe() {
      captured = useToast();
      return null;
    }
    render(
      <ToastProvider>
        <Probe />
      </ToastProvider>
    );
    expect(captured).not.toBeNull();
    expect(Array.isArray(captured!.toasts)).toBe(true);
    expect(typeof captured!.showToast).toBe("function");
    expect(typeof captured!.removeToast).toBe("function");
  });

  it("throws when useToasts used outside provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OutsideToasts />)).toThrow(/useToasts must be used within ToastProvider/);
    spy.mockRestore();
  });

  it("throws when useToastActions used outside provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OutsideActions />)).toThrow(/useToastActions must be used within ToastProvider/);
    spy.mockRestore();
  });
});

function OutsideToasts() {
  useToasts();
  return null;
}

function OutsideActions() {
  useToastActions();
  return null;
}
