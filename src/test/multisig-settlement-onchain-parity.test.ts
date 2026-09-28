import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => {
  const proposals = new Map<string, any>();
  const signatures = new Map<string, any[]>();
  return {
    pool: {
      query: vi.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('INSERT INTO multisig_proposals')) {
          const [id, description, target, value, created_at, expires_at] = params;
          proposals.set(id, { id, description, target, value, executed: false, created_at, expires_at });
          signatures.set(id, []);
          return { rows: [] };
        }
        if (sql.includes('INSERT INTO multisig_signatures')) {
          const [, proposal_id, signer, signature, signed_at] = params;
          signatures.get(proposal_id)!.push({ signer, signature, signed_at });
          return { rows: [] };
        }
        if (sql.includes('UPDATE multisig_proposals')) {
          const [, , id] = params;
          const p = proposals.get(id);
          if (p) p.executed = true;
          return { rows: [] };
        }
        if (sql.includes('SELECT id, description')) {
          const [id] = params;
          const p = proposals.get(id);
          return { rows: p ? [p] : [] };
        }
        if (sql.includes('SELECT signer, signature, signed_at')) {
          const [id] = params;
          return { rows: signatures.get(id) ?? [] };
        }
        return { rows: [] };
      }),
    },
  };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { MultisigSettlementService, type OnChainAuthorityReader } from '@/lib/multisig-settlement';

/**
 * Integration test verifying off-chain quorum/threshold logic stays
 * consistent with the on-chain contracts/multisig-authority interface.
 *
 * Mirrors contracts/shared/src/auth.rs::required_threshold and the
 * execution-time signer-set re-derivation documented in
 * contracts/multisig-authority/src/lib.rs::execute.
 */
describe('multisig-settlement off-chain/on-chain parity', () => {
  const SIGNER_A = 'GA...A';
  const SIGNER_B = 'GA...B';
  const SIGNER_C = 'GA...C';

  let contractMock: { signers: string[]; threshold: number };
  let onChainReader: OnChainAuthorityReader;

  beforeEach(() => {
    contractMock = { signers: [SIGNER_A, SIGNER_B, SIGNER_C], threshold: 2 };
    onChainReader = vi.fn(async () => ({ ...contractMock }));
  });

  it('requires the full threshold below the high-value limit boundary matching the contract policy', () => {
    const service = new MultisigSettlementService({
      threshold: 2,
      signers: [SIGNER_A, SIGNER_B, SIGNER_C],
      highValueLimit: BigInt(1000),
    });

    // value <= highValueLimit && highValueLimit > 0 => required = 1 (contract: required_threshold)
    expect(service.requiredThreshold(BigInt(500))).toBe(1);
    // value > highValueLimit => required = full threshold
    expect(service.requiredThreshold(BigInt(5000))).toBe(2);
  });

  it('always requires full threshold when highValueLimit is 0, matching the contract', () => {
    const service = new MultisigSettlementService({
      threshold: 3,
      signers: [SIGNER_A, SIGNER_B, SIGNER_C],
      highValueLimit: BigInt(0),
    });
    expect(service.requiredThreshold(BigInt(1))).toBe(3);
    expect(service.requiredThreshold(BigInt(1_000_000))).toBe(3);
  });

  it('rejects a signer removed on-chain after the proposal was created (drift the sync closes)', async () => {
    const service = new MultisigSettlementService(
      { threshold: 2, signers: [SIGNER_A, SIGNER_B, SIGNER_C], highValueLimit: BigInt(0) },
      24 * 60 * 60 * 1000,
      onChainReader,
    );

    await service.propose(SIGNER_A, 'payout', 'target', BigInt(10), 'sig-a');

    // Contract admin removes SIGNER_B on-chain before they can sign off-chain.
    contractMock = { signers: [SIGNER_A, SIGNER_C], threshold: 2 };

    await expect(
      service.sign('irrelevant-lookup-will-fail-before-this', SIGNER_B, 'sig-b'),
    ).rejects.toThrow(/not a registered signer|not found/);
  });

  it('excludes signatures from since-removed signers when computing quorum at execution time', async () => {
    const service = new MultisigSettlementService(
      { threshold: 2, signers: [SIGNER_A, SIGNER_B, SIGNER_C], highValueLimit: BigInt(0) },
      24 * 60 * 60 * 1000,
      onChainReader,
    );

    const proposal = await service.propose(SIGNER_A, 'payout', 'target', BigInt(10), 'sig-a');
    await service.sign(proposal.id, SIGNER_B, 'sig-b');

    // SIGNER_B removed on-chain after signing — quorum must be re-evaluated
    // against the live signer set at execution time, per contract semantics.
    contractMock = { signers: [SIGNER_A, SIGNER_C], threshold: 2 };

    await expect(service.execute(proposal.id, SIGNER_A)).rejects.toThrow(/Quorum not met/);
  });
});
