// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildRollbackManifest,
  deriveRunId,
  generateSeedRun,
  validateSeedRun,
} from '@/src/features/scholarships/seed';
import type { SeedRun } from '@/src/features/scholarships/seed';

describe('scholarships staging seed flow', () => {
  it('generates the same run and record set from the same seed key', () => {
    const runA = generateSeedRun({ seedKey: 'wave-2026', environment: 'staging' });
    const runB = generateSeedRun({ seedKey: 'wave-2026', environment: 'staging' });

    expect(runA.runId).toBe(runB.runId);
    expect(runA.programIds).toEqual(runB.programIds);
    expect(runA.applicantIds).toEqual(runB.applicantIds);
    expect(runA.wallets).toEqual(runB.wallets);
  });

  it('derives different runs for different environments', () => {
    const staging = deriveRunId('wave-2026', 'staging');
    const testnet = deriveRunId('wave-2026', 'testnet');

    expect(staging).not.toBe(testnet);
  });

  it('uses synthetic identity only and honors the requested scope', () => {
    const run = generateSeedRun({ seedKey: 'wave-2026', environment: 'testnet', scope: { programs: 2, applicants: 10, reviewers: 2, milestones: 8, payments: 12 } });

    expect(run.syntheticIdentity).toBe(true);
    expect(run.applicants.length).toBe(10);
    expect(run.programs.length).toBe(2);
    expect(run.milestones.length).toBe(8);
  });

  it('produces valid testnet wallet addresses', () => {
    const run = generateSeedRun({ seedKey: 'wave-2026', environment: 'testnet' });

    for (const wallet of run.wallets) {
      expect(wallet.address).toMatch(/^[GS][A-HJ-NP-Z2-9]{55}$/);
      expect(wallet.isTestnetAsset).toBe(true);
    }
  });

  it('passes validation for deterministic runs with unique IDs and intact references', () => {
    const run = generateSeedRun({ seedKey: 'wave-2026', environment: 'staging' });
    const validation = validateSeedRun(run);

    expect(validation.ok).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  it('flags wallet references and non-synthetic runs during validation', () => {
    const run: SeedRun = generateSeedRun({ seedKey: 'wave-2026', environment: 'staging' });
    const tampered: SeedRun = {
      ...run,
      syntheticIdentity: false as unknown as SeedRun['syntheticIdentity'],
      wallets: [{ id: 'wallet-x', address: 'not-an-address', network: 'staging', isTestnetAsset: true }],
    };

    const validation = validateSeedRun(tampered);

    expect(validation.ok).toBe(false);
    expect(validation.errors.some((error) => error.includes('synthetic identity'))).toBe(true);
    expect(validation.errors.some((error) => error.includes('valid 56-character Stellar testnet address'))).toBe(true);
  });

  it('keeps a rollback manifest that covers every created ID and marks revocation', () => {
    const run = generateSeedRun({ seedKey: 'wave-2026', environment: 'staging' });
    const manifest = buildRollbackManifest(run, '2026-09-24T10:00:00.000Z');

    expect(manifest.createdIds.length).toBe(
      run.programIds.length + run.applicantIds.length + run.reviewerIds.length + run.walletIds.length + run.milestoneIds.length + run.paymentIds.length
    );
    expect(manifest.createdIds).toEqual(
      expect.arrayContaining(run.applicantIds.slice(0, 3))
    );
    expect(manifest.revokedAt).toBeDefined();
  });
});