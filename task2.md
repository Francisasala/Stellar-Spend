#940 [Frontend] Enforce strict TypeScript types in src/components
Repo Avatar
Lex-Studios/Stellar-Spend
Description:
Replace remaining any/implicit-any usages in component props with explicit interfaces.

Tasks:

Grep for : any across src/components
Add proper prop interfaces
Enable noImplicitAny scoped rule if missing

Acceptance Criteria:
Zero any in src/components
tsc passes with no new errors
Code review passed

Type: Cleanup | Priority: P2-Medium | Estimated Effort: 1-2 days

#939 [Frontend] Remove unused npm dependencies from package.json
Repo Avatar
Lex-Studios/Stellar-Spend
Description:
package.json likely has stale deps unused since earlier refactors; prune with depcheck.

Tasks:

Run depcheck/knip against package.json
Remove unused packages
Verify build and tests still pass

Acceptance Criteria:
depcheck reports zero unused
Build passes
Tested (unit + E2E smoke)

Type: Cleanup | Priority: P2-Medium | Estimated Effort: 3-5 hours

#938 [Frontend] Split large context providers into scoped contexts
Repo Avatar
Lex-Studios/Stellar-Spend
Description:
src/contexts likely has broad providers causing unnecessary re-renders across the tree.

Tasks:

Audit context value shape in src/contexts
Split into scoped providers (auth, wallet, ui)
Update consumers to use narrower hooks

Acceptance Criteria:
Re-render count reduced (profiler evidence)
Tested (unit)
Code review passed

Type: Refactor | Priority: P1-High | Estimated Effort: 1-2 days

#937 [Frontend] Memoize expensive derived state in dashboard components
Repo Avatar
Lex-Studios/Stellar-Spend
Description:
Dashboard recomputes aggregates on every render; add useMemo/useCallback where profiling shows cost.

Tasks:

Profile dashboard render with React DevTools
Add memoization to top 3 hotspots
Verify no stale-state regressions

Acceptance Criteria:
Measured render time improvement documented
Tested (unit)
Code review passed

Type: Refactor | Priority: P2-Medium | Estimated Effort: 3-5 hours
