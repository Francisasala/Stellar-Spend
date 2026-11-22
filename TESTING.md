# Testing Guide

This document covers how to write and run tests for Stellar-Spend.

---

## Table of Contents

1. [Running Tests](#running-tests)
2. [Unit Testing](#unit-testing)
3. [Integration Testing](#integration-testing)
4. [E2E Testing with Playwright](#e2e-testing-with-playwright)
5. [Test Coverage](#test-coverage)
6. [Mocking Strategies](#mocking-strategies)

---

## Running Tests

```bash
# Run all unit/integration tests once
npm test

# Watch mode (re-runs on file change)
npm run test:watch

# Run E2E tests
npm run test:e2e
```

---

## Unit Testing

Unit tests use **Vitest** + **React Testing Library** and live alongside the code they test.

### File conventions

| Target            | Location                                                |
| ----------------- | ------------------------------------------------------- |
| Library / utility | `src/lib/**/*.test.ts`                                  |
| React component   | `src/test/*.test.tsx` or `src/app/__tests__/*.test.tsx` |
| API route handler | `src/test/*.test.ts`                                    |

### Setup

`src/test/setup.ts` is loaded before every suite and imports `@testing-library/jest-dom` matchers (e.g. `toBeInTheDocument`, `toHaveValue`).

### Writing a unit test

```ts
import { describe, it, expect } from 'vitest';
import { validateAmount } from '@/lib/offramp/utils/validation';

describe('validateAmount', () => {
  it('returns true for a valid positive number', () => {
    expect(validateAmount('10.5')).toBe(true);
  });

  it('returns false for an empty string', () => {
    expect(validateAmount('')).toBe(false);
  });
});
```

### Writing a component test

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Header } from '@/components/Header';

describe('Header', () => {
  it('renders the connect wallet button when disconnected', () => {
    render(<Header isConnected={false} onConnect={vi.fn()} />);
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
  });
});
```

---

## Integration Testing

Integration tests verify that multiple modules work together — for example, an API route handler calling real service logic with mocked external dependencies.

### Pattern

1. Import the Next.js route handler directly.
2. Construct a `NextRequest` with the required body/params.
3. Mock only the external boundary (SDK, env, network).
4. Assert the `Response` status and JSON body.

```ts
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/env', () => ({
  env: {
    server: { PAYCREST_API_KEY: 'test-key' /* ... */ },
    public: {
      /* ... */
    },
  },
}));

const { POST } = await import('@/app/api/offramp/quote/route');

describe('POST /api/offramp/quote', () => {
  it('returns 400 for a missing amount', async () => {
    const req = new NextRequest('http://localhost/api/offramp/quote', {
      method: 'POST',
      body: JSON.stringify({ currency: 'NGN' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

---

## E2E Testing with Playwright

E2E tests live in `./e2e/` and run against a real dev server on `http://localhost:3001`.

### Configuration highlights (`playwright.config.ts`)

- Browsers: a cross-browser matrix of **Chromium (Desktop Chrome)**, **Firefox**, and **WebKit** (Issue #1016).
- Base URL: `http://localhost:3001`
- CI: 2 retries, 1 worker, `forbidOnly` enabled
- Traces captured on first retry for debugging

> **Runtime impact (Issue #1016):** each spec runs once per browser engine, so the
> full E2E suite takes roughly **3×** the previous runtime. To run a single engine:
>
> ```bash
> npx playwright test --project=chromium
> npx playwright test --project=firefox
> npx playwright test --project=webkit
> ```

### Writing cross-browser-safe E2E tests

- Prefer auto-waiting assertions (`expect(...).toBeVisible()`) over
  `page.waitForNavigation()`, which is unreliable for SPA route changes in
  Firefox/WebKit. Wait for a concrete selector instead.
- `toHaveScreenshot()` snapshots are stored per project
  (`chromium/`, `firefox/`, `webkit/`), so visual regressions are tracked per engine.

### Running locally

```bash
# Starts the dev server automatically, then runs tests
npm run test:e2e

# Run a specific spec file
npx playwright test e2e/smoke.spec.ts

# Run against a single browser engine
npx playwright test --project=webkit e2e/smoke.spec.ts

# Open the HTML report after a run
npx playwright show-report
```

### Writing an E2E test

```ts
import { test, expect } from '@playwright/test';

test.describe('Off-ramp flow', () => {
  test('page loads with correct title and connect button', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Stellar-Spend/i);
    await expect(page.getByRole('button', { name: /connect wallet/i })).toBeVisible();
  });
});
```

### Wallet interactions

Freighter and Lobstr are browser extensions and cannot be installed in Playwright's Chromium. For flows that require a connected wallet, stub `window.freighter` / `window.lobstr` via `page.addInitScript` before navigation.

---

## Test Coverage

Coverage is not enforced by a hard threshold today, but the following targets are expected:

| Layer                | Target                                                  |
| -------------------- | ------------------------------------------------------- |
| `src/lib/` utilities | ≥ 80% line coverage                                     |
| API route handlers   | All happy-path + primary error branches covered         |
| React components     | Key render states and user interactions covered         |
| E2E                  | Critical user journey (load → connect → submit) covered |

### Type Coverage (issue #1359)

TypeScript type coverage is measured with [`type-coverage`](https://github.com/plantain-00/type-coverage) and enforced locally via `.type-coverage`.

| Metric             | Value                                                        |
| ------------------ | ------------------------------------------------------------ |
| **Baseline**       | **98.38%** (93 452 / 94 984 nodes)                           |
| **Enforced floor** | **98%** (configured in `.type-coverage`)                     |
| Measured at        | 2026-10-22, commit on `fix/code-quality-1319-1320-1359-1360` |

To run locally:

```bash
npm run type:coverage           # check and fail below threshold
npm run type:coverage:detail    # show each un-typed node
```

The threshold is set in `.type-coverage` (`"atLeast": 98`). The CI `type:coverage` script enforces it on every push.

To generate a coverage report locally:

```bash
npx vitest run --coverage
```

> Coverage output is written to `./coverage/`. The directory is git-ignored.

---

## Mocking Strategies

### Environment variables

Always mock `@/lib/env` rather than setting `process.env` directly to keep tests hermetic.

```ts
vi.mock('@/lib/env', () => ({
  env: {
    server: {
      PAYCREST_API_KEY: 'test-api-key',
      PAYCREST_WEBHOOK_SECRET: 'test-secret',
      BASE_PRIVATE_KEY: '0xdeadbeef',
      BASE_RETURN_ADDRESS: '0xreturn',
      BASE_RPC_URL: 'https://base-rpc.test',
      STELLAR_SOROBAN_RPC_URL: 'https://soroban.test',
      STELLAR_HORIZON_URL: 'https://horizon.test',
    },
    public: {
      NEXT_PUBLIC_STELLAR_SOROBAN_RPC_URL: 'https://soroban.test',
      NEXT_PUBLIC_BASE_RETURN_ADDRESS: '0xreturn',
      NEXT_PUBLIC_STELLAR_USDC_ISSUER: 'GISSUER',
    },
  },
}));
```

### External SDKs (Allbridge, Stellar, viem)

Mock the SDK class/module at the top of the test file with minimal fake data.

```ts
vi.mock('@allbridge/bridge-core-sdk', () => ({
  AllbridgeCoreSdk: class {
    chainDetailsMap = vi.fn();
    buildSwapAndBridgeTx = vi.fn().mockResolvedValue({ tx: 'fake-xdr' });
  },
  nodeRpcUrlsDefault: {},
}));
```

### Rate limiter

```ts
vi.mock('@/lib/offramp/utils/rate-limiter', () => ({
  buildTxLimiter: { check: () => ({ allowed: true }) },
  getClientIp: () => '127.0.0.1',
}));
```

### React component callbacks

Use `vi.fn()` for all callback props and assert with `toHaveBeenCalledWith`.

```ts
const onSubmit = vi.fn();
render(<FormCard {...baseProps} onSubmit={onSubmit} />);
await userEvent.click(screen.getByRole('button', { name: /submit/i }));
expect(onSubmit).toHaveBeenCalledOnce();
```

### `localStorage`

`jsdom` provides a real `localStorage` implementation. Clear it in `beforeEach` to prevent cross-test pollution.

```ts
beforeEach(() => localStorage.clear());
```

---

## OpenAPI Contract Tests (Issue #834)

Contract tests live in `src/test/contract/openapi-contract.test.ts` and run automatically as part of `npm test`.

### What they verify

- Every route handler's response conforms to the schema in `openapi.yaml`.
- Required fields are present (`required: [...]` in the spec is enforced via AJV).
- The `Error` schema's `error` enum only contains documented codes.
- No undocumented top-level fields drift into responses (`additionalProperties: false` applied structurally).
- All `$ref` targets in `components/schemas` resolve without errors (orphaned refs are caught).

### Running just the contract tests

```bash
npx vitest --run src/test/contract/openapi-contract.test.ts
```

### Updating `openapi.yaml` when the backend contract changes

1. **Add / change an endpoint:** edit the relevant `paths` entry in `openapi.yaml`.
2. **Add / change a response schema:** edit the corresponding entry in `components/schemas`.
3. **Regenerate from routes (optional):** if your team uses `openapi-typescript` or a similar generator, run it and then diff `openapi.yaml` to confirm the changes are intentional:

   ```bash
   # Example with openapi-typescript (install separately if needed)
   npx openapi-typescript openapi.yaml -o src/types/api.d.ts
   ```

4. **Run the contract suite** to confirm no regressions:

   ```bash
   npx vitest --run src/test/contract/openapi-contract.test.ts
   ```

5. **Commit both** the updated `openapi.yaml` and any affected source files together so the spec stays in sync with the implementation.

### AJV dependency

The contract tests rely on `ajv` and `ajv-formats`, which are already present in `devDependencies`. If they are ever removed, add them back:

```bash
npm install --save-dev ajv ajv-formats js-yaml
```

---

## Mutation Testing with Stryker (Issue #833)

Mutation tests measure whether the unit-test suite can catch code changes (mutations) to library logic.

### Running mutation tests

```bash
npm run test:mutation
```

This invokes `stryker run` using `stryker.conf.json`. The HTML report is written to `./mutation-report/index.html`.

### Mutation score targets

| Threshold        | Value  |
| ---------------- | ------ |
| High (green)     | ≥ 80 % |
| Medium (yellow)  | ≥ 70 % |
| Low (orange)     | ≥ 60 % |
| Break (CI fails) | < 55 % |

### Files mutated by Stryker

Stryker mutates `src/lib/**/*.ts` and `src/app/api/**/*.ts` (see `stryker.conf.json`). The following test files provide coverage that kills mutants:

| Test file                                  | Target lib modules                                                 |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `src/test/mutation.test.ts`                | `fee-calculation`, `error-types`, `paycrest-adapter`, `kyc-limits` |
| `src/test/mutation-critical-paths.test.ts` | `http-client`, `cache/keys`                                        |
| `src/test/fee-calculation.test.ts`         | `fee-calculation` (full coverage)                                  |
| `src/test/error-types.test.ts`             | `error-types`                                                      |
| `src/test/mapPaycrestStatus.test.ts`       | `paycrest-adapter`                                                 |

### Improving the mutation score

When Stryker reports a surviving mutant:

1. Open `./mutation-report/index.html` and find the surviving mutant.
2. Identify which assertion was too weak to catch it (e.g. `toBeTruthy` instead of `toBe(true)`).
3. Add a focused test that asserts the exact value a mutant would change.
4. Re-run `npm run test:mutation` to confirm the score improved.

---

## E2E Testing with Playwright (Issues #831 & #832)

### Overview of E2E specs

| Spec file                                | Issue     | Coverage                                                        |
| ---------------------------------------- | --------- | --------------------------------------------------------------- |
| `e2e/payment-flow.spec.ts`               | #831 (P0) | Connect wallet → amount → quote → recipient → confirm → history |
| `e2e/kyc-rejection-resubmission.spec.ts` | #832      | Unverified → submit → rejected → resubmit → approved lifecycle  |
| `e2e/smoke.spec.ts`                      | —         | Production smoke: health, currencies, rate, UI load             |
| `e2e/critical-journeys.spec.ts`          | —         | Full offramp with axe accessibility checks                      |
| `e2e/transaction-history.spec.ts`        | —         | History display, filter, search, export                         |

### Running E2E tests locally

> **Prerequisite:** The app must be running on `http://localhost:3001`. All external dependencies are mocked inside each spec via `page.route()` — no real API keys are required.

```bash
# Build and start the server (first run)
npm run build && npm start &

# Or use the dev server (faster iteration)
npm run dev &

# Run all E2E tests
npm run test:e2e

# Run a single spec file
npx playwright test e2e/payment-flow.spec.ts

# Run KYC spec only
npx playwright test e2e/kyc-rejection-resubmission.spec.ts

# Run headless with visible browser for debugging
npx playwright test --headed e2e/payment-flow.spec.ts

# Open the HTML report after a run
npx playwright show-report
```

### Running in CI

CI sets `CI=true` which enables:

- 2 retries on flaky tests
- Single worker (serial execution)
- `forbidOnly` (test.only fails the run)
- HTML report saved as an artifact

```yaml
# Example GitHub Actions step
- name: Run E2E tests
  run: npm run test:e2e
  env:
    CI: true
    BASE_URL: http://localhost:3001
```

### Mocking strategy in E2E tests

**Wallet (Freighter):** stubbed via `page.addInitScript()` before navigation. The stub auto-approves all `signTransaction` calls and returns a deterministic public key.

**API endpoints:** mocked via `page.route('**/api/...**', ...)` at the top of each `beforeEach`. This intercepts all matching fetch/XHR calls and returns JSON fixtures without touching the network.

**Transaction history (localStorage):** seeded via `page.addInitScript()` using `localStorage.setItem` before the page loads.

### Writing new E2E tests

Use the patterns established in `e2e/payment-flow.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3001';

test.beforeEach(async ({ page }) => {
  // 1. Stub wallet
  await page.addInitScript(() => {
    (window as any).freighter = {
      isConnected: async () => true,
      getPublicKey: async () => 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      signTransaction: async (xdr: string) => xdr,
    };
  });

  // 2. Mock APIs
  await page.route('**/api/offramp/quote**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ destinationAmount: '158200.00', rate: 1582, currency: 'NGN' }),
    }),
  );
});

test('my new scenario', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  // ... assertions ...
});
```

### KYC fixtures

Structured test data for KYC flows is in `e2e/fixtures/kyc-fixtures.ts`:

```ts
import { KYC_USERS, KYC_REJECTION_REASONS, KYC_API_RESPONSES } from './fixtures/kyc-fixtures';

// Use pre-built rejection API responses in page.route():
await page.route('**/api/kyc**', (route) =>
  route.fulfill({
    status: 200,
    body: JSON.stringify(KYC_API_RESPONSES.getRejected('documentUnreadable')),
  }),
);
```

---

## Code Coverage Thresholds (Issue #1348)

### Overview

Stellar-Spend enforces code coverage thresholds to prevent coverage regressions and maintain test suite quality. Coverage is measured across all test runs and reported in the HTML coverage report at `./coverage/index.html`.

### Global thresholds

All files must meet these minimum thresholds:

| Metric     | Threshold |
| ---------- | --------- |
| Lines      | 85%       |
| Statements | 85%       |
| Functions  | 85%       |
| Branches   | 80%       |

### Per-file thresholds for critical paths

Some modules have stricter per-file thresholds due to their security/payment-critical nature:

| Module               | Lines | Statements | Functions | Branches | Reason                      |
| -------------------- | ----- | ---------- | --------- | -------- | --------------------------- |
| `src/lib/auth/**`    | 90%   | 90%        | 90%       | 85%      | Security-critical           |
| `src/lib/offramp/**` | 85%   | 85%        | 85%       | 80%      | Payment flows               |
| `src/lib/onramp/**`  | 85%   | 85%        | 85%       | 80%      | Onboarding flows            |
| `src/app/api/**`     | 80%   | 80%        | 80%       | 75%      | Route handlers (lower req.) |

### Running coverage locally

```bash
# Generate a new coverage report
npm run test:coverage

# Or use vitest directly
npx vitest run --coverage

# View the HTML report
open coverage/index.html
```

### CI enforcement

A GitHub Actions workflow (`.github/workflows/test-coverage.yml`) runs on every PR and enforces coverage thresholds. The workflow:

1. Runs all tests with coverage collection
2. Fails if any global or per-file threshold is not met
3. Posts a comment on the PR with the coverage summary
4. Uploads the coverage report as an artifact for review

### Coverage failures

If a PR fails the coverage check:

1. **View the report:** download the artifact from the Actions tab or run locally with `npm run test:coverage`
2. **Identify gaps:** open `coverage/index.html`, find the uncovered lines/branches
3. **Write tests:** add or update tests to cover the gaps
4. **Verify:** re-run locally until `npm run test:coverage` passes, then push
5. **Re-check:** the CI workflow will re-run automatically and pass

### Best practices for maintaining coverage

- **Test behavior, not implementation:** aim for high branch coverage by testing both happy-path and error branches (not just lines).
- **Focus on critical paths:** don't just increase coverage for coverage's sake; prioritize security/payment flows.
- **Use snapshots sparingly:** snapshot tests can inflate coverage without catching real bugs. Prefer explicit assertions.
- **Mock external boundaries:** mock SDKs and APIs so tests are fast and deterministic; real network calls slow down the suite.
- **Exclude test utilities:** generated code, fixtures, and test helpers are excluded from coverage (see `exclude` in `vitest.config.ts`).

### Debugging coverage gaps

If `npm run test:coverage` shows unexpected gaps:

1. **Run a focused test file:**

   ```bash
   npx vitest run --coverage src/lib/your-module.test.ts
   ```

2. **Check which test covered which line:**

   ```bash
   npx vitest run --coverage -- --reporter=verbose src/lib/your-module.test.ts
   ```

3. **Check for dead code:** if a line is never covered despite a test, it may be unreachable or a logic error. Simplify or remove it.

4. **Review branch coverage:** branch coverage is often lower than line coverage. Open the HTML report and hover over red branches to see which condition branches are missed.

---

## Snapshot Testing & Hygiene (Issue #1346)

### Overview

Snapshots capture the exact output of a test and compare future test runs against that baseline. Snapshots are useful for complex object serialization or large text diffs, but they can become stale or orphaned if not properly maintained.

### When to use snapshots

Use snapshots for:

- **Complex serialized objects:** database records, API responses, or multi-line JSON with many nested fields
- **HTML/component output:** when testing the structure of a rendered component with many children
- **Generated text:** compiled SQL, transformed code, or formatted output strings
- **Approval workflows:** when a human needs to review and approve a change to the output format

**Do NOT use snapshots for:**

- **Constantly-changing data:** timestamps, random IDs, or dynamic content that fails on every run
- **Brittle HTML structure:** component renders that change often; prefer explicit `getByRole()` assertions instead
- **Simple values:** if the expected value is short (< 50 chars), write it explicitly: `expect(result).toBe('exact value')`
- **Snapshot-only testing:** always include at least one explicit assertion alongside snapshots to catch logic errors

### Snapshot file locations

Snapshots live in `__snapshots__/` directories collocated with their test files:

```
src/lib/
  formatters.test.ts
  __snapshots__/
    formatters.test.ts.snap
```

### Creating snapshots

Run tests in update mode to create or update snapshots:

```bash
# Update all snapshots
npm run test:snapshots:update

# Update snapshots for a specific file
npm run test:snapshots:update -- src/lib/formatters.test.ts
```

When you update snapshots, **always review the diff** in version control before committing. Look for:

- Changes you expected (e.g., new fields added to an object)
- Changes you did NOT expect (e.g., data format drift, accidental code changes)
- Increased output size or redundancy

### Snapshot validation

Before committing, validate that all snapshots are hygenic:

```bash
npm run test:snapshots:validate
```

This checks for:

- **Orphaned snapshots:** snapshot files with no corresponding test file
- **Missing snapshots:** test files that call `.toMatchSnapshot()` but have no `.snap` file
- **Formatting issues:** trailing whitespace or invalid format in snapshot files

Validation also runs as a pre-commit hook (when Husky is set up) to prevent orphaned snapshots from entering the repo.

### Reviewing snapshot changes in GitHub

When a PR includes snapshot updates:

1. **GitHub PR view:** click "Display the rich diff" or "Show spaces and tabs" to see the exact changes
2. **Local review:** check out the PR branch and run `npm test` to see the diff in the terminal
3. **Approve with context:** look for explanations in the PR description or commit messages about why snapshots changed

### Debugging snapshot failures

If a test fails with a snapshot mismatch:

```bash
# View the difference
npm run test:snapshots -- src/lib/formatters.test.ts
```

You'll see:

```
Snapshot name: `should format date correctly`
- Snapshot
+ Received

- {foo: "bar"}
+ {foo: "baz"}
```

**Option 1: The test is wrong** — Fix the test logic and re-run

**Option 2: The snapshot is outdated** — Review the change, then:

```bash
npm run test:snapshots:update -- src/lib/formatters.test.ts
```

**Option 3: Partial updates** — Some snapshots changed, some didn't. Use interactive mode:

```bash
npm run test:snapshots -- --reporter=verbose
```

Then select which snapshots to update.

### Snapshot best practices

1. **Keep snapshots small:** if a snapshot grows beyond 20 lines, consider breaking the test into smaller assertions
2. **Write assertion comments:** explain why a particular field is expected
   ```ts
   expect(apiResponse).toMatchSnapshot(); // API returns paginated results with metadata
   ```
3. **Use inline snapshots for small values:**
   ```ts
   expect(formatDate('2024-01-15')).toMatchInlineSnapshot(`"Jan 15, 2024"`);
   ```
4. **Test one scenario per snapshot:** don't combine multiple test cases into one snapshot
5. **Update CI snapshots carefully:** never auto-update snapshots in CI; always require a developer to review and commit the change locally

### Snapshot exclusions from coverage

Snapshot test files are excluded from code coverage calculations by default (see `vitest.config.ts` exclude patterns). This prevents snapshot-heavy tests from inflating coverage metrics.

---

## Storybook Interaction Tests (Issue #1347)

### Overview

Storybook interaction tests use the `play()` function to simulate user interactions and verify component behavior within stories. These tests run in a real browser via Vitest with the Playwright provider, providing more realistic interaction testing than unit tests alone.

### When to use interaction tests vs. unit tests

| Scenario               | Interaction Test                   | Unit Test                     |
| ---------------------- | ---------------------------------- | ----------------------------- |
| Testing click handlers | ✅ Use play()                      | Unit test callback            |
| Testing form input     | ✅ Use play()                      | Unit test value/onChange      |
| Testing focus/blur     | ✅ Use play()                      | Unit test for aria attributes |
| Testing accessibility  | ✅ Use play()                      | Unit test tree structure      |
| Testing business logic | ❌                                 | ✅ Use unit test              |
| Testing error states   | Interaction for UI, unit for logic | Unit test                     |

### Core UI primitives with interaction tests

Interaction tests have been added to the following core components:

| Component | Tests Added                                            | Coverage                                                |
| --------- | ------------------------------------------------------ | ------------------------------------------------------- |
| `Button`  | Interactive, InteractiveWithCallback                   | Click, enabled/disabled state                           |
| `Input`   | Interactive, InteractiveWithClear, DisabledInteraction | Type, focus/blur, disabled state                        |
| `Label`   | Interactive, AccessibilityTest                         | htmlFor association, tag structure                      |
| `Badge`   | Interactive, VariantStates                             | Rendering, variant display                              |
| `Alert`   | Interactive, VariantDisplay                            | Title/body rendering, variant states                    |
| `Card`    | Interactive, InteractiveWithButtons                    | Composition (header/content/footer), button interaction |

### Writing Storybook interaction tests

#### Basic pattern

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { userEvent, within, expect } from '@storybook/test';
import { MyComponent } from './MyComponent';

const meta: Meta<typeof MyComponent> = {
  title: 'Components/MyComponent',
  component: MyComponent,
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const Interactive: Story = {
  args: {
    /* story args */
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 1. Query the element
    const element = canvas.getByRole('button', { name: /click me/i });

    // 2. Simulate user interaction
    await userEvent.click(element);

    // 3. Assert the result
    await expect(element).toBeInTheDocument();
  },
};
```

#### Key imports

```tsx
import { userEvent, within, expect } from '@storybook/test';
```

- **`userEvent`:** simulates realistic user interactions (click, type, hover, etc.)
- **`within`:** scopes DOM queries to the component canvas
- **`expect`:** assertions from Vitest (same as unit tests)

#### Common interactions

```tsx
// Click
await userEvent.click(button);

// Type text
await userEvent.type(input, 'Hello');

// Clear input
await userEvent.clear(input);

// Focus
await userEvent.click(input); // Focus on click

// Tab (navigate focus)
await userEvent.tab();

// Hover
await userEvent.hover(element);

// Keyboard shortcuts
await userEvent.hotKeys(element, 'ctrl+a'); // Select all
await userEvent.hotKeys(element, 'Escape'); // Escape key
```

#### Common assertions

```tsx
// DOM presence
await expect(element).toBeInTheDocument();

// Value (for inputs)
await expect(input).toHaveValue('expected value');

// Attributes
await expect(element).toHaveAttribute('disabled');
await expect(label).toHaveAttribute('for', 'input-id');

// Classes (for styled variants)
await expect(button).toHaveClass('primary');

// Text content
await expect(element).toHaveTextContent('Text');
await expect(element).toHaveText Exact('Exact Text');

// Disabled state
await expect(button).toBeDisabled();
await expect(input).not.toBeDisabled();

// Focus
await expect(input).toHaveFocus();
```

### Running interaction tests

#### Run all Storybook tests

```bash
npm run test-storybook
```

#### Run tests for a specific story file

```bash
npm run test-storybook -- src/components/ui/Button.stories.tsx
```

#### Run tests in headed mode (see browser)

```bash
npm run test-storybook -- --headed
```

#### Debug a failing story

```bash
npm run test-storybook -- src/components/ui/Button.stories.tsx --headed
```

Then open the browser DevTools to inspect the component and interaction.

### Best practices

1. **Keep interactions realistic:** use `userEvent` (not `fireEvent`) for natural interaction patterns
2. **Test one scenario per story:** don't combine multiple interactions into one play() function
3. **Scope with `within(canvasElement)`:** prevents queries from leaking outside the component
4. **Assert state changes, not implementation:** check what the user sees/experiences, not internal state
5. **Use accessible queries:** prefer `getByRole()`, `getByLabelText()` over `getByTestId()`
6. **Comment complex interactions:** explain why a test exists if not obvious

### Troubleshooting

**"Element not found" error:**

- Use `getByRole('button', { name: /label/i })` for better debugging
- Add `screen.debug()` in the play() function to see the rendered HTML

**Flaky tests (sometimes pass, sometimes fail):**

- Add `await page.waitForLoadState('networkidle')` if component fetches data
- Avoid hard timeouts; use assertions that wait (Storybook waits up to 10s by default)

**Tests run locally but fail in CI:**

- Ensure all args are provided (no undefined values)
- Mock external dependencies consistently
- Check browser version compatibility (Playwright uses Chromium in CI)
