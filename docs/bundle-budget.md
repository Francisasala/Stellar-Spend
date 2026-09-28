# Bundle Size Budget

> **Tracking issue:** #948 – Add bundle-size budget and trim heavy imports

## Budget

| Metric | Limit | Notes |
|--------|-------|-------|
| Total `.next/` directory | 150 MB | Enforced in CI (`ci.yml`) |
| Total JS static assets | 350 KB | Enforced in CI (`ci.yml`) |
| Max entrypoint size | 512 KB | Enforced via Webpack `performance.hints` |
| Max asset size | 512 KB | Enforced via Webpack `performance.hints` |

## How to Check

```bash
# Analyze the bundle interactively (opens browser report)
npm run build:analyze

# Check total .next/ directory size
du -sh .next/

# Check total JS bundle size
find .next/static -name "*.js" | xargs wc -c | tail -1
```

## Known Heavy Dependencies

| Package | Approx. Size | Mitigation |
|---------|-------------|------------|
| `@stellar/stellar-sdk` | ~2 MB | Server-only via `serverExternalPackages` + `optimizePackageImports` |
| `@allbridge/bridge-core-sdk` | ~1.5 MB | Server-only via `serverExternalPackages` + `optimizePackageImports` |
| `viem` | ~800 KB | `optimizePackageImports` enables tree-shaking |
| `@sentry/nextjs` | ~400 KB | `optimizePackageImports` + lazy tunnel |
| `xlsx` | ~750 KB | Dynamic import via `await import('xlsx')` in `src/lib/export.ts` |

## Import Guidelines

### Do

```typescript
// ✅ Named import from a specific sub-module
import { formatUnits } from 'viem/utils';

// ✅ Dynamic import for heavy, infrequently-used libraries
const { utils, writeFile } = await import('xlsx');
```

### Don't

```typescript
// ❌ Full barrel import of a large library (prevents tree-shaking)
import * as XLSX from 'xlsx';

// ❌ Top-level static import of an infrequently-used heavy library
import XLSX from 'xlsx';
```

## Webpack Configuration

`next.config.ts` enforces the following in production builds:

- `performance.hints: 'warning'` — emits build warnings when individual assets exceed 512 KB
- `performance.maxEntrypointSize: 512 * 1024` — 512 KB entrypoint budget
- `performance.maxAssetSize: 512 * 1024` — 512 KB per-asset budget
- `optimizePackageImports` — tree-shaking for `@stellar/stellar-sdk`, `@allbridge/bridge-core-sdk`, `viem`, `@sentry/nextjs`
- `serverExternalPackages` — keeps Stellar/Allbridge SDKs and `pg` server-side only

## CI Enforcement

The `ci.yml` workflow (`Check bundle sizes` step) runs after `npm run build` and:

1. Lists the largest JS chunks in the GitHub Actions summary
2. Calculates total static JS size and fails if it exceeds 350 KB

Run `npm run build:analyze` locally and inspect the output to identify large chunks before opening a PR.
