# Quality Gate Tests (`__tests__/quality/`)

This directory contains **quality-gate tests** — automated checks that enforce project-wide policies which cannot be caught by ordinary unit or integration tests. They run as part of the standard `npm test` suite.

---

## Why a separate directory?

Quality gate tests differ from unit tests in one key way: **they test the project itself**, not the application's behaviour. They verify structural, policy, and hygiene properties such as:

- Are critical dependencies pinned to exact versions?
- Is the project's dependency-update policy documented?
- Does the Renovate configuration cover ranged dependencies?

Placing these alongside unit tests in `src/test/` would pollute the application test surface; placing them here makes their special status immediately apparent.

---

## Tests in this directory

### `dependency-pinning.test.ts`

**Purpose**: Enforces the project's dependency version-pinning policy.

**What it checks**:

| Check | Rationale |
|---|---|
| `package.json` exists and is valid JSON | Sanity: the project must have a manifest |
| Hard-pinned deps (`react`, `react-dom`, `typescript`) use exact versions | These packages affect hydration parity and type-system guarantees — a silent minor bump can introduce subtle regressions |
| `.github/renovate.json` exists | Renovate is the safety net for range-versioned deps; if it is absent the "allow range" policy has no automation backing it |
| `CONTRIBUTING.md` documents "Version Pinning" | Every contributor must understand the policy |
| Renovate config includes `packageRules` | Traceability: range-allowed deps should be covered by an explicit automation rule |

**Hard-pinned deps** (must be exact, e.g. `"19.0.0"` not `"^19.0.0"`):
- `react`
- `react-dom`
- `typescript`

**Range-allowed deps** (caret ranges `^` are fine — Renovate manages bumps):
- `next`, `@stellar/stellar-sdk`, `@sentry/nextjs`, `@allbridge/bridge-core-sdk`, `viem`

**Stability**: This test does NOT assert that all dependencies are pinned. Earlier versions of this file made that assertion, which caused it to fail on every greenfield setup (all dev deps use `^` by default). The current version only enforces the small, intentional set of hard-pinned packages.

---

## Running quality gate tests

```bash
# Run all tests including quality gates
npm test

# Run only quality gate tests
npx vitest run __tests__/quality/

# Watch mode
npx vitest __tests__/quality/ --watch
```

---

## Adding a new quality gate

1. Create a new file in `__tests__/quality/` with a `.test.ts` extension.
2. Use `vitest`'s `describe` / `it` / `expect` — no additional setup needed.
3. Add a row to the table above explaining what the test checks and why.
4. Ensure the test passes on the current codebase before committing (run `npm test` locally).

---

## What belongs here vs. `src/test/`

| Belongs in `__tests__/quality/` | Belongs in `src/test/` |
|---|---|
| Checks that `package.json` policies are followed | Unit tests for library functions |
| Checks that documentation exists / contains required sections | Integration tests for API routes |
| Checks for presence of config files (Renovate, `.gitignore`, etc.) | Component tests |
| CI hygiene (licence headers, secret scanning config) | E2E flows (these live in `e2e/`) |
