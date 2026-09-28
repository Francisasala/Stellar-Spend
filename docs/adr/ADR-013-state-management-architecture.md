# ADR-013: State Management Architecture — React Context & Scoped Custom Hooks

**Status:** Accepted  
**Date:** 2026-08-25  
**Deciders:** Stellar-Spend Core Team  

---

## Context

In building the Stellar-Spend frontend (Next.js 15 App Router, React 19, TypeScript), state management requirements span several distinct domains:
1. **Global Application State:** Locale/i18n, theme preference (light/dark/system), and transient UI notifications (toasts).
2. **Web3 / Wallet State:** Connected wallet type (Freighter, Lobstr), active account public key, network passphrase, and wallet connection lifecycle.
3. **Transaction & Off-ramp Flow State:** Currency conversion inputs, live FX quotes, bridge status, Paycrest payout progress, and KYC verification step.
4. **Persistent Client State:** Transaction history, saved views, and user preferences stored in browser `localStorage` ([ADR-001](./ADR-001-localstorage-transaction-history.md)).
5. **Server / Remote State:** Live FX spot rates, supported currencies, transaction polling status, and feature flags.

Contributors have previously proposed introducing third-party global state libraries such as **Redux Toolkit (RTK)**, **Zustand**, or **Jotai**. Without an explicit Architecture Decision Record, discussions risk repeatedly re-litigating state management choices.

This ADR records the architectural decision to use **React Context for low-frequency global UI concerns** combined with **domain-specific Custom Hooks and Local State for feature flows**, explaining the tradeoffs versus Redux and Zustand.

---

## Decision

We adopt a **tiered state management strategy** using native React 19 primitives:
- **React Context (`src/contexts/`):** Reserved exclusively for low-frequency global state that spans the entire component tree (Theme, Toast, I18n).
- **Domain Custom Hooks (`src/hooks/`):** Encapsulate business logic, wallet integration, polling, and local persistence into reusable, self-contained units (e.g., `useStellarWallet`, `useTransactionHistory`, `usePollBridgeStatus`).
- **Local Component State (`useState`, `useReducer`):** Used for localized component interactions (form fields, modal open/close, toggle states).
- **Browser Persistence (`localStorage`):** Handled via synchronized storage adapters (`useTransactionHistory`, `useSyncSettings`).

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           State Hierarchy                               │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │ AppProviders (src/contexts/AppProviders.tsx)                    │   │
│   │  ├─ I18nProvider (Locale / Translations)                        │   │
│   │  ├─ ErrorBoundary (Global Error Containment)                    │   │
│   │  ├─ ThemeProvider (Light / Dark Mode)                           │   │
│   │  └─ ToastProvider (Transient Feedback Notifications)            │   │
│   └────────────────────────────────┬────────────────────────────────┘   │
│                                    │                                    │
│   ┌────────────────────────────────▼────────────────────────────────┐   │
│   │ Domain Hooks (src/hooks/)                                       │   │
│   │  ├─ useStellarWallet       (Wallet connection & signing)        │   │
│   │  ├─ useCurrencyConverter   (FX calculations & fee breakdown)    │   │
│   │  ├─ usePollBridgeStatus    (Allbridge transaction polling)      │   │
│   │  ├─ usePollPayoutStatus    (Paycrest order polling)             │   │
│   │  └─ useTransactionHistory  (localStorage sync & filters)        │   │
│   └────────────────────────────────┬────────────────────────────────┘   │
│                                    │                                    │
│   ┌────────────────────────────────▼────────────────────────────────┐   │
│   │ Scoped / Local Component State (useState, useReducer)           │   │
│   │  └─ OfframpForm, QuoteCard, BankSelector, ModalControls         │   │
│   └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Provider Composition Order

Global context providers are strictly composed in [`src/contexts/AppProviders.tsx`](../../src/contexts/AppProviders.tsx):

```tsx
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <I18nProvider>
      <ErrorBoundary>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </I18nProvider>
  );
}
```

- **`I18nProvider`:** Outermost provider ensuring localization strings are available to error boundaries and theme wrappers.
- **`ErrorBoundary`:** Catches rendering exceptions across all descendant context consumers.
- **`ThemeProvider`:** Manages theme class toggles on `<html>` without triggering re-render cascades in business logic components.
- **`ToastProvider`:** Provides imperative and declarative notification APIs (`addToast`, `removeToast`).

---

## Tradeoff Analysis: Context + Hooks vs Alternatives

| Criteria | React Context + Scoped Hooks (Chosen) | Zustand / Jotai | Redux Toolkit (RTK) |
| :--- | :--- | :--- | :--- |
| **Bundle Size Overhead** | **0 KB** (Built into React 19) | +3 KB to +8 KB | +30 KB to +45 KB (Redux + RTK + React-Redux) |
| **Next.js 15 / RSC Compatibility** | Native. Clear boundary between server and `'use client'` contexts. | Requires store initialization wrappers for SSR hydration. | High complexity for SSR; store re-hydration boilerplate required. |
| **Re-render Performance** | High for low-frequency state. Scoped hooks prevent global re-renders. | Fine-grained selector-based subscription. | Fine-grained selector-based subscription. |
| **Architecture Complexity & Boilerplate** | Low. Standard React patterns known to all React developers. | Low-Medium. Requires creating custom store hooks. | High. Actions, reducers, slices, dispatchers, and selectors. |
| **Testing Ergonomics** | Simple. Render hook with standard `@testing-library/react`. | Requires mock store instances or reset between tests. | Requires mock root store and provider fixtures. |
| **Separation of Concerns** | Strong domain isolation per hook (`useStellarWallet`, `useFxRate`). | Risks creating a bloated "catch-all" global state object. | Tendency toward centralized monolithic store. |

### Why Not Redux Toolkit?
1. **Excessive Overhead:** Stellar-Spend is a focused financial off-ramp, not a multi-tenant enterprise dashboard with thousands of interdependent state mutations. Redux introduces significant boilerplate (actions, reducers, thunks, middleware) without tangible architectural benefits.
2. **Hydration Friction:** Next.js Server Components and streaming SSR require elaborate store synchronization logic when using Redux.

### Why Not Zustand / Jotai?
1. **Premature Dependency:** Our application state is naturally compartmentalized:
   - Wallet state is only needed by transaction-initiation surfaces.
   - Quote and rate data are short-lived and fetched per flow.
   - History state is read/written to `localStorage`.
2. Introducing an external state library adds an external dependency without resolving an active bottleneck.
3. Keeping state in native React hooks makes refactoring, testing, and dependency updates seamless across React major versions.

---

## Guidelines for Contributors

1. **Do NOT add global state for local features:** Form inputs, active tabs, dropdown open states, and step indices belong in local `useState` / `useReducer`.
2. **Do NOT put high-frequency state in React Context:** If a state changes multiple times per second (e.g. animated tickers, drag coordinates, rapid typing), placing it in React Context will trigger re-renders in all consumers. Keep it in local state or ref-based subscriptions.
3. **Encapsulate async and domain logic in `src/hooks/`:** Complex operations (e.g. polling Paycrest status every 5 seconds with exponential backoff) must be wrapped in a custom hook (e.g. `usePollPayoutStatus`).
4. **Maintain Provider Order:** When adding a new global provider, propose it via an ADR update and place it in `AppProviders.tsx` respecting the dependency hierarchy.

---

## Consequences

**Positive:**
- Zero additional client bundle weight.
- Clear separation between UI concerns (`src/contexts/`), business logic (`src/hooks/`), and view components (`src/components/`).
- Full compatibility with Next.js 15 App Router and React Server Components.
- Intuitive onboarding for new engineers familiar with idiomatic React.

**Negative / Trade-offs:**
- Sharing state between two deeply nested sibling trees that cannot share a common parent component requires lifting state up or using a dedicated scoped Context provider.
- Context consumers re-render when the provided context value changes (mitigated by memoizing context values with `useMemo` and separating distinct contexts).

---

_Related: [ADR-001 (localStorage Transaction History)](./ADR-001-localstorage-transaction-history.md), [ADR-003 (Adapter Pattern for External Services)](./ADR-003-adapter-pattern-external-services.md), [ADR-010 (Real-Time Transport)](./ADR-010-realtime-transport-sse-vs-websocket.md)_
