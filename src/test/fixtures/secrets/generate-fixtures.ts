/**
 * Runtime generator for synthetic secret fixtures (Issue #1336).
 *
 * These fixtures are intentionally fake credentials used by the gitleaks
 * regression test. They are generated at test-time rather than committed to
 * the repository to avoid tripping secret scanners.
 *
 * Call `generateFixtures()` in a `beforeAll` block before the tests run.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SECRETS_DIR = join(__dirname);

export function generateFixtures(): void {
  mkdirSync(SECRETS_DIR, { recursive: true });

  writeFileSync(
    join(SECRETS_DIR, 'aws-credentials.env'),
    [
      '# Synthetic fixture: AWS access key id (fake, for gitleaks regression coverage)',
      'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLEKEY',
      'AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    ].join('\n'),
  );

  writeFileSync(
    join(SECRETS_DIR, 'github-pat.env'),
    [
      '# Synthetic fixture: GitHub personal access token (fake, for gitleaks regression coverage)',
      'GITHUB_TOKEN=ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789',
    ].join('\n'),
  );

  writeFileSync(
    join(SECRETS_DIR, 'slack-token.env'),
    [
      '# Synthetic fixture: Slack token (fake, for gitleaks regression coverage)',
      'SLACK_BOT_TOKEN=slack-synth-token-1234567890123456789AbCdEfGhIjKlMnOp',
      'SLACK_APP_TOKEN=slack-synth-app-1A012B3CDEF1a2b3c4d5e6f7g8h9i0j',
    ].join('\n'),
  );

  writeFileSync(
    join(SECRETS_DIR, 'stripe-key.env'),
    [
      '# Synthetic fixture: Stripe secret key (fake, for gitleaks regression coverage)',
      'STRIPE_SECRET_KEY=stripe-synth-key-AbCdEfGhIjKlMnOpQrStUvWx',
    ].join('\n'),
  );

  writeFileSync(
    join(SECRETS_DIR, 'private-key.pem'),
    [
      '-----BEGIN RSA PRIVATE KEY-----',
      'MIIEpAIBAAKCAQEA1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOP',
      'QRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVW',
      'XY0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ01234',
      '-----END RSA PRIVATE KEY-----',
    ].join('\n'),
  );

  writeFileSync(
    join(SECRETS_DIR, 'generic-api-key.env'),
    [
      '# Synthetic fixture: generic high-entropy API key (fake, for gitleaks regression coverage)',
      'API_KEY="a8f5f167f44f4964e6c998dee827110c"',
      'DB_PASSWORD="S3cr3tP@ssw0rd!2024"',
    ].join('\n'),
  );

  writeFileSync(
    join(SECRETS_DIR, 'gcp-api-key.json'),
    JSON.stringify(
      {
        gcp_api_key: 'AIzaSyA1234567890abcdefABCDEF1234567890xyz',
        project_id: 'stellar-spend-dev',
      },
      null,
      2,
    ),
  );
}
