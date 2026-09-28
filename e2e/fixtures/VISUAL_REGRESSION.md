# Visual regression baselines

Screenshot baselines for Playwright visual regression tests (including
`e2e/dashboard-visual-regression.spec.ts`) are stored under
`e2e/fixtures/visual-regression/<test-file-name>/`, one folder per spec file,
per `snapshotPathTemplate` in `playwright.config.ts`.

## Reviewing a failing visual test

1. Run the suite: `npm run test:e2e -- e2e/dashboard-visual-regression.spec.ts`.
2. On a mismatch, Playwright writes `-actual.png` and `-diff.png` files next to
   the expected baseline and the HTML report highlights the pixel diff.
3. Open the HTML report (`npx playwright show-report`) to inspect the diff.

## Updating baselines after an intentional UI change

Only update baselines once the underlying UI change has been reviewed and
merged/approved — an updated baseline silently accepts whatever the page
currently renders as "correct".

```bash
# Update every baseline for the dashboard visual regression spec
npx playwright test e2e/dashboard-visual-regression.spec.ts --update-snapshots

# Update a single screen
npx playwright test e2e/dashboard-visual-regression.spec.ts -g "settings screen" --update-snapshots
```

Commit the regenerated `.png` files under `e2e/fixtures/visual-regression/`
alongside the UI change in the same PR so reviewers can see both together.
