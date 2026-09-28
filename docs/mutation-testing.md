# Mutation Testing

Mutation testing measures the **quality** of the test suite by injecting deliberate bugs (mutations) into source code and verifying that the tests catch them. A mutation that is not caught is a "surviving mutant" — a signal that a test case is missing or too weak.

Stellar-Spend uses [Stryker](https://stryker-mutator.io/) (v7) with the Vitest test runner.

---

## Quick reference

```bash
# Full mutation run (all files in the mutate glob)
npm run test:mutation

# Pilot scope only — src/lib — faster, recommended for local dev
npx stryker run --mutate "src/lib/**/*.ts,!src/lib/**/*.test.ts"

# Single file — fastest feedback loop
npx stryker run --mutate "src/lib/fee-calculation.ts"

# View the HTML report after a run
xdg-open mutation-report/index.html   # Linux
open mutation-report/index.html       # macOS
```

---

## Configuration files

| File | Purpose |
|---|---|
| `stryker.conf.json` | Stryker configuration — mutate glob, reporters, thresholds, TypeScript checker |
| `vitest.mutation.config.ts` | Vitest config used by Stryker — restricts to jsdom, excludes E2E tests |

### Thresholds (`stryker.conf.json`)

| Level | Score | Effect |
|---|---|---|
| `break` | 55 | CI fails — do not merge below this |
| `low` | 60 | Warning in CI output |
| `medium` | 70 | Warning in CI output |
| `high` | 80 | Target for green badge |

---

## Pilot scope

The current mutation target is `src/lib/**` — the core business-logic layer. This layer has:

- The best unit coverage (good signal-to-noise ratio for Stryker)
- The highest value for catching logic errors (fee calculations, FX conversions, bridge amounts)

Once the pilot mutation score is **stable ≥ 55%**, coverage can be extended to `src/app/api`.

### Mutation groups

Stryker groups related files so you can run subsets:

| Group | Files |
|---|---|
| `money-path` | `src/lib/cache/service.ts`, `src/lib/cache/keys.ts`, `src/lib/clients/http-client.ts`, `src/lib/clients/paycrest.ts`, `src/lib/clients/allbridge.ts` |
| `security` | `src/lib/clients/http-client.ts` |

```bash
# Run only the money-path group
npx stryker run --mutationGroups money-path
```

---

## Interpreting the report

After a run, open `mutation-report/index.html`. The report shows:

- **Killed**: mutation was detected by at least one test — good.
- **Survived**: no test caught this mutation — add or strengthen a test.
- **No coverage**: no test executed this code at all — investigate dead code or missing tests.
- **Timeout**: a mutant caused an infinite loop — usually means a loop-condition mutation.

### Target scores by layer

| Layer | Target mutation score |
|---|---|
| `src/lib/` utilities | ≥ 80% |
| API route handlers (`src/app/api/`) | ≥ 70% |
| Business logic (`offramp/`, `api-keys/`) | ≥ 75% |

---

## Improving mutation scores

1. **Assert exact values** — `expect(result).toBe(42)` kills arithmetic mutants; `expect(result).toBeTruthy()` does not.
2. **Boundary tests** — for every numeric limit, test `n - 1`, `n`, and `n + 1`.
3. **Branch coverage** — every `if` / ternary / `||` path needs at least one test.
4. **Error paths** — test what happens when an external call throws, not just when it succeeds.
5. **Return value tests** — verify the shape and values of what a function returns, not just that it ran.

### Example: weak vs strong test

```ts
// Weak — survives most arithmetic mutations
it('calculates fee', () => {
  expect(calculateBridgeFee(100)).toBeTruthy();
});

// Strong — kills negation, arithmetic, and off-by-one mutations
it('calculates bridge fee as 0.5% of amount', () => {
  expect(calculateBridgeFee(100)).toBe(0.5);
  expect(calculateBridgeFee(200)).toBe(1.0);
  expect(calculateBridgeFee(0)).toBe(0);
});
```

---

## Running in CI

The `test:mutation` npm script runs the full Stryker suite:

```bash
npm run test:mutation
```

CI will fail if the mutation score drops below the `break` threshold (55%). The HTML and JSON reports are uploaded as CI artifacts for inspection.

---

## Output files

| Path | Contents |
|---|---|
| `mutation-report/index.html` | Interactive HTML report (git-ignored) |
| `mutation-report/mutation-report.json` | Machine-readable JSON (git-ignored) |

Both output paths are listed in `.gitignore` — mutation reports should never be committed.
