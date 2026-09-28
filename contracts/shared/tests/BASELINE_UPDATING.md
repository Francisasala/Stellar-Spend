# Gas / Instruction-Cost Regression Tests

This directory contains `gas_regression.rs`, which verifies that helper functions
in `contracts/shared/src/` do not silently grow their CPU-instruction footprint.

## How the tests work

Each test:
1. Resets the soroban budget to unlimited (`env.cost_estimate().budget().reset_unlimited()`).
2. Reads the CPU-instruction counter before the call.
3. Calls the function under test.
4. Reads the counter again and computes the delta.
5. Asserts `delta ≤ baseline × 1.10` (10 % regression band).

## Updating baselines intentionally

When a deliberate change increases instruction cost (SDK upgrade, new validation
logic, etc.):

1. **Run the reporter** to see the current live values:
   ```bash
   cargo test -p stellar-spend-shared -- --nocapture print_current_baselines
   ```
   Example output:
   ```
   === Instruction-cost baselines (soroban-sdk 22.x, native Rust) ===
     require_positive_amount(1_000_000)                       312 instructions
     require_basis_points(50, 500)                            289 instructions
     …
   ```

2. **Update the constants** at the top of `gas_regression.rs`:
   ```rust
   const BASELINE_POSITIVE_AMOUNT: u64 = 312;   // updated from 250
   ```

3. **Commit with a clear message**, e.g.:
   ```
   chore(contracts): update gas baselines after soroban-sdk 22 → 23 upgrade

   Instruction counts increased by ~5% across the board due to the host's
   new validation pass in v23.  Baselines updated to the measured values.
   ```

## Never change a baseline to hide a regression

If a test fails and you did **not** intentionally change the code or upgrade the
SDK, investigate before updating the baseline.  Likely causes:
- An added `clone()` or extra host call inside a hot path.
- A new branch that runs on every call instead of only the error path.
- A loop whose iteration count grew unexpectedly.
