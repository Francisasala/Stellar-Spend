# Architecture & Data Flow: State Management

This document visualizes the state management architecture and data flows across the Stellar-Spend application as defined in [ADR-013](../adr/ADR-013-state-management-architecture.md).

---

## 1. Provider Tree & Context Hierarchy

All global context providers are encapsulated within `AppProviders` and wrapped around the React tree.

```mermaid
graph TD
    Root["Root Layout (app/layout.tsx)"]
    AP["AppProviders (contexts/AppProviders.tsx)"]
    I18n["I18nProvider (lib/i18n/provider.tsx)<br/>- currentLocale<br/>- translations dictionary"]
    EB["ErrorBoundary (components/ErrorBoundary.tsx)<br/>- catches render errors"]
    TP["ThemeProvider (contexts/ThemeContext.tsx)<br/>- theme: 'light' | 'dark' | 'system'<br/>- resolvedTheme"]
    Toast["ToastProvider (contexts/ToastContext.tsx)<br/>- toasts: ToastMessage[]<br/>- addToast() / removeToast()"]
    Page["Page View / Route Components<br/>(app/page.tsx, components/*)"]

    Root --> AP
    AP --> I18n
    I18n --> EB
    EB --> TP
    TP --> Toast
    Toast --> Page
```

---

## 2. Off-Ramp State Flow (Hooks & Services)

Data flow during a transaction lifecycle, illustrating how hooks orchestrate wallet interaction, API polling, and local storage updates.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Form as Offramp Form Component
    participant Converter as useCurrencyConverter<br/>(src/hooks/useCurrencyConverter.ts)
    participant Wallet as useStellarWallet<br/>(src/hooks/useStellarWallet.ts)
    participant API as Next.js API Routes<br/>(src/app/api/)
    participant BridgePoll as usePollBridgeStatus<br/>(src/hooks/usePollBridgeStatus.ts)
    participant PayoutPoll as usePollPayoutStatus<br/>(src/hooks/usePollPayoutStatus.ts)
    participant History as useTransactionHistory<br/>(src/hooks/useTransactionHistory.ts)
    participant Toast as useToast / ToastContext<br/>(src/contexts/ToastContext.tsx)

    User->>Form: Enter Amount & Select Currency
    Form->>Converter: computeDestinationAmount(amount, currency)
    Converter->>API: GET /api/offramp/quote
    API-->>Converter: Return quote (rate, bridgeFee, estimatedTotal)
    Converter-->>Form: Render conversion breakdown

    User->>Form: Click "Initiate Off-Ramp"
    Form->>Wallet: signTransaction(xdr)
    Wallet-->>User: Prompt wallet signature (Freighter/Lobstr)
    User->>Wallet: Approve
    Wallet->>API: POST /api/offramp/bridge/submit-soroban
    API-->>Wallet: { txHash, status: "PENDING" }

    Form->>History: saveTransaction({ txHash, amount, currency, status: "PENDING" })
    History->>History: Sync to browser localStorage
    Form->>Toast: addToast({ title: "Transaction Submitted", type: "info" })

    par Poll Bridge Settlement
        Form->>BridgePoll: startPolling(txHash)
        BridgePoll->>API: GET /api/offramp/bridge/status/[txHash]
        API-->>BridgePoll: { status: "COMPLETED", baseTxHash: "0x..." }
    and Poll Paycrest Payout
        Form->>PayoutPoll: startPolling(orderId)
        PayoutPoll->>API: GET /api/offramp/status/[orderId]
        API-->>PayoutPoll: { status: "PAID", bankRef: "REF123" }
    end

    PayoutPoll-->>Form: Payout Confirmed
    Form->>History: updateTransaction(txHash, { status: "COMPLETED" })
    Form->>Toast: addToast({ title: "Funds Transferred to Bank!", type: "success" })
```

---

## 3. Tiered State Boundaries

```mermaid
graph LR
    subgraph Global["Global Context (contexts/)"]
        direction TB
        G1[Theme: light / dark]
        G2[Toasts: Active Notifications]
        G3[I18n: Locale & Strings]
    end

    subgraph Domain["Domain Hooks (hooks/)"]
        direction TB
        D1[useStellarWallet: Public Key, Network]
        D2[useFxRate: Live Ticker]
        D3[usePollPayoutStatus: Order State]
        D4[useTransactionHistory: Filter, Search]
    end

    subgraph Storage["Client Persistence"]
        S1[(localStorage: Tx History)]
        S2[(localStorage: Settings / Prefs)]
    end

    subgraph Local["Local Component State"]
        L1[Form Inputs & Validation]
        L2[Modal Open / Close]
        L3[Step Wizard Index]
    end

    Global -.->|Consumed by| Local
    Domain -->|Encapsulates async & syncs| Storage
    Domain -->|Provides state & handlers to| Local
```
