//! Gas / instruction-cost regression tests for `stellar-spend-shared` (issue #998).
//!
//! Soroban contracts have a hard CPU-instruction budget per transaction.  A future
//! change that accidentally adds a loop, a deep clone, or an extra host call could
//! silently push a real transaction over that budget and break production.
//!
//! ## Strategy
//! These tests measure the CPU-instruction consumption of each hot-path helper by
//! running it inside a `Env::default()` and reading `env.cost_estimate().budget().cpu_instruction_cost()`
//! before and after.  Each assertion allows a **+10 % regression band** above the
//! recorded baseline; tightening this to the exact recorded value would make every
//! cosmetic refactor fail, while widening it further would let real regressions slip.
//!
//! ## Updating baselines intentionally
//! 1. Run `cargo test -p stellar-spend-shared -- --nocapture print_current_baselines` to
//!    see the live instruction counts for the current SDK version.
//! 2. Update the `BASELINE_*` constant beside the failing assertion.
//! 3. Add a commit message that explains *why* the cost changed (SDK upgrade,
//!    deliberate optimisation, new validation rule, etc.).
//!
//! **Never** change a baseline to silence an unexpected regression; investigate first.
//!
//! ## What is NOT tested here
//! Memory-byte consumption is excluded: it is not observable through the public
//! `Budget` API at the unit-test level and is typically dominated by the token client,
//! not by shared helpers.

use soroban_sdk::{testutils::Address as _, Address, Env, String};
use stellar_spend_shared::auth::{required_threshold, verify_threshold};
use stellar_spend_shared::validation::{
    basis_points_of, check_schema_version, require_basis_points, require_positive_amount,
    require_string_len, require_unique_addresses, MAX_SIGNERS,
};

// ─────────────────────────────────────────────────────────────────────────────
// Baselines (CPU instructions)
//
// Measured on soroban-sdk 22.x running natively (not WASM).
// Native Rust instruction counts are lower than WASM equivalents; these
// baselines exist to catch relative regressions, not to certify absolute on-chain
// costs.
//
// Update these constants when the SDK version changes or when a deliberate
// optimisation is made. See module-level doc for the procedure.
// ─────────────────────────────────────────────────────────────────────────────

const BASELINE_POSITIVE_AMOUNT: u64 = 1_000;
const BASELINE_BASIS_POINTS: u64 = 1_000;
const BASELINE_STRING_LEN: u64 = 5_000;
const BASELINE_SCHEMA_VERSION: u64 = 1_000;
const BASELINE_BASIS_POINTS_OF: u64 = 2_000;
const BASELINE_REQUIRED_THRESHOLD: u64 = 1_000;
const BASELINE_VERIFY_THRESHOLD: u64 = 2_000;
const BASELINE_UNIQUE_ADDRESSES_5: u64 = 50_000;
const BASELINE_UNIQUE_ADDRESSES_MAX: u64 = 1_000_000;

/// Regression band: allow costs to grow by at most this fraction above the baseline.
/// 0.10 = 10 % — enough headroom for SDK patch changes; tight enough to catch real regressions.
const REGRESSION_BAND: f64 = 0.10;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Assert that `actual` does not exceed `baseline * (1 + REGRESSION_BAND)`.
fn assert_no_regression(fn_name: &str, baseline: u64, actual: u64) {
    let ceiling = (baseline as f64 * (1.0 + REGRESSION_BAND)) as u64;
    assert!(
        actual <= ceiling,
        "\n\n[gas regression] {fn_name} exceeded the allowed ceiling.\n\
         Baseline : {baseline} instructions\n\
         Ceiling  : {ceiling} instructions (+{:.0}%)\n\
         Actual   : {actual} instructions\n\n\
         If this is intentional, update BASELINE_{upper} in gas_regression.rs\n\
         after running: cargo test -p stellar-spend-shared -- --nocapture print_current_baselines\n",
        REGRESSION_BAND * 100.0,
        upper = fn_name.to_uppercase().replace([' ', '(', ')'], "_"),
    );
}

/// Reset the budget to unlimited, run `f`, then return the CPU instruction delta.
fn measure<F: FnOnce()>(env: &Env, f: F) -> u64 {
    env.cost_estimate().budget().reset_unlimited();
    let before = env.cost_estimate().budget().cpu_instruction_cost();
    f();
    let after = env.cost_estimate().budget().cpu_instruction_cost();
    after.saturating_sub(before)
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual entrypoint tests
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn cost_require_positive_amount() {
    let env = Env::default();
    let cost = measure(&env, || {
        require_positive_amount(1_000_000).unwrap();
    });
    assert_no_regression("require_positive_amount", BASELINE_POSITIVE_AMOUNT, cost);
}

#[test]
fn cost_require_positive_amount_rejects_zero() {
    // Rejection path must not be materially more expensive than the success path.
    let env = Env::default();
    let cost = measure(&env, || {
        let _ = require_positive_amount(0);
    });
    assert_no_regression(
        "require_positive_amount(reject)",
        BASELINE_POSITIVE_AMOUNT,
        cost,
    );
}

#[test]
fn cost_require_basis_points() {
    let env = Env::default();
    let cost = measure(&env, || {
        require_basis_points(50, 500).unwrap();
    });
    assert_no_regression("require_basis_points", BASELINE_BASIS_POINTS, cost);
}

#[test]
fn cost_require_string_len() {
    let env = Env::default();
    let s = String::from_str(&env, "hello-stellar-spend");
    let cost = measure(&env, || {
        require_string_len(&s, 32).unwrap();
    });
    assert_no_regression("require_string_len", BASELINE_STRING_LEN, cost);
}

#[test]
fn cost_check_schema_version_current() {
    let env = Env::default();
    let cost = measure(&env, || {
        check_schema_version(Some(2), 2).unwrap();
    });
    assert_no_regression("check_schema_version", BASELINE_SCHEMA_VERSION, cost);
}

#[test]
fn cost_basis_points_of() {
    let env = Env::default();
    let cost = measure(&env, || {
        basis_points_of(1_000_000, 50).unwrap();
    });
    assert_no_regression("basis_points_of", BASELINE_BASIS_POINTS_OF, cost);
}

#[test]
fn cost_required_threshold_low_value() {
    let env = Env::default();
    let cost = measure(&env, || {
        let _ = required_threshold(3, 1_000, 500);
    });
    assert_no_regression("required_threshold", BASELINE_REQUIRED_THRESHOLD, cost);
}

#[test]
fn cost_verify_threshold_pass() {
    let env = Env::default();
    let cost = measure(&env, || {
        verify_threshold(3, 3, 0, 9_999).unwrap();
    });
    assert_no_regression("verify_threshold", BASELINE_VERIFY_THRESHOLD, cost);
}

/// `require_unique_addresses` is O(n²) — measure both a small set and the maximum
/// signer set so any accidental O(n³) introduction shows up immediately.
#[test]
fn cost_unique_addresses_five() {
    let env = Env::default();
    let addrs: soroban_sdk::Vec<Address> = soroban_sdk::vec![
        &env,
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
    ];
    let cost = measure(&env, || {
        require_unique_addresses(&addrs).unwrap();
    });
    assert_no_regression(
        "require_unique_addresses(5)",
        BASELINE_UNIQUE_ADDRESSES_5,
        cost,
    );
}

#[test]
fn cost_unique_addresses_max_signers() {
    let env = Env::default();
    let mut addrs_vec = soroban_sdk::vec![&env];
    for _ in 0..MAX_SIGNERS {
        addrs_vec.push_back(Address::generate(&env));
    }
    let cost = measure(&env, || {
        require_unique_addresses(&addrs_vec).unwrap();
    });
    assert_no_regression(
        "require_unique_addresses(MAX_SIGNERS)",
        BASELINE_UNIQUE_ADDRESSES_MAX,
        cost,
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Baseline reporter
//
// Run with:
//   cargo test -p stellar-spend-shared -- --nocapture print_current_baselines
//
// Copy the printed values into the BASELINE_* constants at the top of this file.
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn print_current_baselines() {
    let env = Env::default();

    macro_rules! report {
        ($label:expr, $body:expr) => {{
            let cost = measure(&env, $body);
            println!("  {:<55}  {:>12} instructions", $label, cost);
            cost
        }};
    }

    println!("\n=== Instruction-cost baselines (soroban-sdk 22.x, native Rust) ===");

    report!("require_positive_amount(1_000_000)", || {
        require_positive_amount(1_000_000).unwrap();
    });

    report!("require_basis_points(50, 500)", || {
        require_basis_points(50, 500).unwrap();
    });

    let s = String::from_str(&env, "hello-stellar-spend");
    report!("require_string_len(&s, 32)", || {
        require_string_len(&s, 32).unwrap();
    });

    report!("check_schema_version(Some(2), 2)", || {
        check_schema_version(Some(2), 2).unwrap();
    });

    report!("basis_points_of(1_000_000, 50)", || {
        basis_points_of(1_000_000, 50).unwrap();
    });

    report!("required_threshold(3, 1_000, 500)", || {
        let _ = required_threshold(3, 1_000, 500);
    });

    report!("verify_threshold(3, 3, 0, 9_999)", || {
        verify_threshold(3, 3, 0, 9_999).unwrap();
    });

    let five_addrs: soroban_sdk::Vec<Address> = soroban_sdk::vec![
        &env,
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
    ];
    report!("require_unique_addresses(5 addrs)", || {
        require_unique_addresses(&five_addrs).unwrap();
    });

    let mut max_addrs = soroban_sdk::vec![&env];
    for _ in 0..MAX_SIGNERS {
        max_addrs.push_back(Address::generate(&env));
    }
    report!("require_unique_addresses(MAX_SIGNERS addrs)", || {
        require_unique_addresses(&max_addrs).unwrap();
    });

    println!("===\n");
    println!(
        "Update the BASELINE_* constants in gas_regression.rs with the values above.\n\
         Regression ceiling = baseline × {:.0}%.\n",
        (1.0 + REGRESSION_BAND) * 100.0
    );
}
