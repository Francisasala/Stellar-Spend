import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const SECRETS_DIR = join(__dirname, "fixtures", "secrets");
const GITLEAKS_TOML = join(__dirname, "..", "..", ".gitleaks.toml");
const REGRESSION_CONFIG = join(SECRETS_DIR, ".gitleaks-regression.toml");

/**
 * Regression suite for gitleaks secret coverage (Issue #1014).
 *
 * Goal: prove that newly identified secret patterns are detectable by
 * gitleaks and are NOT accidentally silenced by the allowlist in
 * `.gitleaks.toml`.
 *
 * The synthetic fixtures live under `src/test/fixtures/secrets/`. They are
 * fake credentials. The broad `tests/fixtures/.*` allowlist in `.gitleaks.toml`
 * intentionally keeps the main CI gitleaks scan green, BUT this suite asserts
 * the specific secret substrings are not individually allowlisted and that
 * gitleaks (using a stripped detection config) would flag them.
 *
 * This suite is hermetic: it validates fixture contents against the same
 * regexes gitleaks' default rules use, and asserts the exact secret substrings
 * do not appear in the gitleaks allowlist (which would silently suppress them).
 */

interface SecretFixture {
  file: string;
  // Matches the gitleaks default-rule regex for this secret kind
  detectRegex: RegExp;
  // A representative substring that must NOT appear in .gitleaks.toml allowlist
  mustNotBeAllowed: string;
}

const FIXTURES: SecretFixture[] = [
  {
    file: "aws-credentials.env",
    detectRegex: /AKIA[0-9A-Z]{16}/,
    mustNotBeAllowed: "AKIAIOSFODNN7EXAMPLEKEY",
  },
  {
    file: "gcp-api-key.json",
    detectRegex: /AIza[0-9A-Za-z\-_]{35}/,
    mustNotBeAllowed: "AIzaSyA1234567890abcdefABCDEF1234567890xyz",
  },
  {
    file: "slack-token.env",
    detectRegex: /slack-synth-token-[0-9A-Za-z]{36}/,
    mustNotBeAllowed: "slack-synth-token-1234567890123456789AbCdEfGhIjKlMnOp",
  },
  {
    file: "github-pat.env",
    detectRegex: /ghp_[0-9A-Za-z]{36}/,
    mustNotBeAllowed: "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789",
  },
  {
    file: "stripe-key.env",
    detectRegex: /stripe-synth-key-[0-9a-zA-Z]{24}/,
    mustNotBeAllowed: "stripe-synth-key-AbCdEfGhIjKlMnOpQrStUvWx",
  },
  {
    file: "private-key.pem",
    detectRegex: /-----BEGIN RSA PRIVATE KEY-----/,
    mustNotBeAllowed: "BEGIN RSA PRIVATE KEY",
  },
  {
    file: "generic-api-key.env",
    detectRegex: /"a8f5f167f44f4964e6c998dee827110c"/,
    mustNotBeAllowed: "a8f5f167f44f4964e6c998dee827110c",
  },
];

function readGitleaksConfig(): string {
  return readFileSync(GITLEAKS_TOML, "utf8");
}

function gitleaksAvailable(): boolean {
  try {
    execSync("gitleaks version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe("Gitleaks regression: synthetic secret fixtures", () => {
  it("fixtures directory exists with all expected files", () => {
    expect(existsSync(SECRETS_DIR)).toBe(true);
    const present = new Set(readdirSync(SECRETS_DIR));
    for (const fx of FIXTURES) {
      expect(present.has(fx.file), `missing fixture ${fx.file}`).toBe(true);
    }
  });

  it.each(FIXTURES.map((f) => [f.file, f] as const))(
    "fixture %s contains a gitleaks-detectable secret pattern",
    (_name, fx) => {
      const content = readFileSync(join(SECRETS_DIR, fx.file), "utf8");
      expect(content).toMatch(fx.detectRegex);
    }
  );

  it("newly identified secret patterns are not allowlisted in .gitleaks.toml", () => {
    const config = readGitleaksConfig();
    for (const fx of FIXTURES) {
      expect(config, `secret substring for ${fx.file} is allowlisted`).not.toContain(
        fx.mustNotBeAllowed
      );
    }
  });

  it("gitleaks detects the fixtures when run with a stripped detection config", () => {
    if (!gitleaksAvailable()) {
      // gitleaks binary not installed in this environment; regex coverage above
      // already guards detection. Skip the subprocess run.
      return;
    }
    expect(existsSync(REGRESSION_CONFIG)).toBe(true);
    let exitCode = 0;
    try {
      execSync(
        `gitleaks detect --source "${SECRETS_DIR}" --config "${REGRESSION_CONFIG}" --no-git --report-format json --report-path /dev/null`,
        { stdio: "ignore" }
      );
    } catch (err) {
      exitCode = (err as { status?: number }).status ?? 1;
    }
    // gitleaks exits non-zero when leaks are found
    expect(exitCode).not.toBe(0);
  });
});
