/**
 * Staging / testnet seed flow.
 *
 * Generates a deterministic, reversible set of synthetic records so operators
 * can rehearse the scholarship decision, milestone, and payment pipelines in
 * staging and on testnet. Every run is reproducible from its seed key, keeps a
 * rollback manifest of every created ID, uses only synthetic identity data
 * (never real applicant PII), and can be revoked in one call.
 */

import { apiClient } from '@/src/lib/api-client';

export type SeedEnvironment = 'staging' | 'testnet';

export type SeedScope = {
  programs: number;
  applicants: number;
  reviewers: number;
  milestones: number;
  payments: number;
};

export const DEFAULT_SEED_SCOPE: SeedScope = {
  programs: 3,
  applicants: 24,
  reviewers: 4,
  milestones: 72,
  payments: 140,
};

export type SeedProgram = { id: string; title: string; sponsor: string; maxAwards: number };
export type SeedApplicant = { id: string; syntheticName: string; region: string; incomeBand: string; enrollmentStatus: 'current' | 'probation' };
export type SeedReviewer = { id: string; syntheticName: string; username: string };
export type SeedWallet = { id: string; address: string; network: SeedEnvironment; isTestnetAsset: boolean };
export type SeedMilestone = {
  id: string;
  programId: string;
  title: string;
  payoutToken: string;
  amount: string;
  status: 'pending' | 'funded';
};
export type SeedPayment = {
  id: string;
  milestoneId: string;
  orderKey: string;
  amount: string;
  status: 'submitted' | 'confirmed' | 'failed';
};

export type SeedRun = {
  runId: string;
  seedKey: string;
  environment: SeedEnvironment;
  generatedAt: string;
  scope: SeedScope;
  programIds: string[];
  applicantIds: string[];
  reviewerIds: string[];
  walletIds: string[];
  milestoneIds: string[];
  paymentIds: string[];
  programs: SeedProgram[];
  applicants: SeedApplicant[];
  reviewers: SeedReviewer[];
  wallets: SeedWallet[];
  milestones: SeedMilestone[];
  payments: SeedPayment[];
  syntheticIdentity: true;
};

export type RollbackManifest = {
  runId: string;
  seedKey: string;
  environments: SeedEnvironment[];
  createdIds: string[];
  revokedAt?: string;
};

// ─── Deterministic PRNG (xmur3 + mulberry32) ─────────────────────────────────

function xmur3(input: string): () => number {
  let hash = 1779033703 ^ input.length;
  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(hash ^ input.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    return (hash ^= hash >>> 16) >>> 0;
  };
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomOf(rand: () => number, items: string[]): string {
  return items[Math.floor(rand() * items.length)] ?? items[0];
}

// ─── Synthetic data pools (no real PII) ──────────────────────────────────────

const SYNTHETIC_PROGRAM_TITLES = [
  'Foundations in Web3 Staging',
  'Smart Contract Fundamentals',
  'Decentralized Finance Track',
  'Creative Building Scholarship',
  'Governance & DAO Engineering',
];
const SPONSOR_POOL = ['Stellar Wave', 'Hummingbird Fund', 'Open Meridian', 'Kepler Learning'];

const SYNTHETIC_FIRST_NAMES = ['Ada', 'Bekele', 'Chioma', 'Devi', 'Elif', 'Fatima', 'Gabriel', 'Hana', 'Ivan', 'Joy', 'Kenji', 'Layla', 'Mateo', 'Nia', 'Omar', 'Priya', 'Qadir', 'Ren', 'Sofia', 'Tariq', 'Umi', 'Viktor', 'Wanjiru', 'Ximena'];
const SYNTHETIC_LAST_NAMES = ['Mensah', 'Petrov', 'Nakamura', 'Silva', 'Okafor', 'Yamada', 'Kowalski', 'Ruiz', 'Haddad', 'Iyer'];
const REGIONS = ['africa', 'asia', 'europe', 'latin-america', 'middle-east'];
const INCOME_BANDS = ['lower', 'lower-middle', 'middle'];
const ENROLLMENT = ['current', 'current', 'probation'] as const;

export const SYNTHETIC_IDENTITY = true;

// ─── Generation ───────────────────────────────────────────────────────────────

export function deriveRunId(seedKey: string, environment: SeedEnvironment): string {
  const hash = xmur3(`${environment}:${seedKey}`)();
  return `seed-${environment}-${hash.toString(36).slice(0, 6)}`;
}

const STELLAR_USABLE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateSeedRun(input: {
  seedKey: string;
  environment: SeedEnvironment;
  scope?: SeedScope;
  now?: Date;
}): SeedRun {
  const scope = { ...DEFAULT_SEED_SCOPE, ...(input.scope ?? {}) };
  const now = input.now ?? new Date();
  const rand = mulberry32(xmur3(input.seedKey)());
  const runId = deriveRunId(input.seedKey, input.environment);

  const pickName = () => `${randomOf(rand, SYNTHETIC_FIRST_NAMES)} ${randomOf(rand, SYNTHETIC_LAST_NAMES)}`;
  const pickAddress = () => {
    const address = Array.from({ length: 55 }, () => STELLAR_USABLE[Math.floor(rand() * STELLAR_USABLE.length)]).join('');
    return `${input.environment === 'testnet' ? 'G' : 'S'}${address}`;
  };

  const programs: SeedProgram[] = Array.from({ length: scope.programs }, (_, index) => ({
    id: `${runId}-program-${index + 1}`,
    title: randomOf(rand, SYNTHETIC_PROGRAM_TITLES),
    sponsor: randomOf(rand, SPONSOR_POOL),
    maxAwards: 4 + Math.floor(rand() * 8),
  }));

  const applicants: SeedApplicant[] = Array.from({ length: scope.applicants }, (_, index) => ({
    id: `${runId}-applicant-${index + 1}`,
    syntheticName: pickName(),
    region: randomOf(rand, REGIONS),
    incomeBand: randomOf(rand, INCOME_BANDS),
    enrollmentStatus: randomOf(rand, ENROLLMENT as unknown as string[]) as SeedApplicant['enrollmentStatus'],
  }));

  const reviewers: SeedReviewer[] = Array.from({ length: scope.reviewers }, (_, index) => {
    const name = pickName();
    return {
      id: `${runId}-reviewer-${index + 1}`,
      syntheticName: name,
      username: `staging-${name.toLowerCase().replace(/[^a-z]/g, '-')}`,
    };
  });

  const wallets: SeedWallet[] = programs.map((program, index) => ({
    id: `${runId}-wallet-${index + 1}`,
    address: pickAddress(),
    network: input.environment,
    isTestnetAsset: true,
  }));

  const milestonesPerProgram = Math.max(1, Math.floor(scope.milestones / Math.max(1, scope.programs)));
  const milestones: SeedMilestone[] = programs.flatMap((program, programIndex) =>
    Array.from({ length: milestonesPerProgram }, (_, milestoneIndex) => ({
      id: `${runId}-milestone-${programIndex * milestonesPerProgram + milestoneIndex + 1}`,
      programId: program.id,
      title: `Milestone ${milestoneIndex + 1}: ${randomOf(rand, ['Foundations', 'Draft', 'Peer review', 'Final release'])}`,
      payoutToken: 'XLM',
      amount: String(100 + Math.floor(rand() * 900)),
      status: (rand() > 0.5 ? 'funded' : 'pending') as SeedMilestone['status'],
    }))
  );

  const paymentsPerMilestone = Math.max(1, Math.floor(scope.payments / Math.max(1, milestones.length)));
  const payments: SeedPayment[] = milestones.flatMap((milestone, milestoneIndex) =>
    Array.from({ length: paymentsPerMilestone }, (_, paymentIndex) => ({
      id: `${runId}-payment-${milestoneIndex * paymentsPerMilestone + paymentIndex + 1}`,
      milestoneId: milestone.id,
      orderKey: `${milestone.id}-payment-${paymentIndex + 1}`,
      amount: String(10 + Math.floor(rand() * 90)),
      status: (rand() > 0.85 ? 'failed' : rand() > 0.3 ? 'confirmed' : 'submitted') as SeedPayment['status'],
    }))
  );

  return {
    runId,
    seedKey: input.seedKey,
    environment: input.environment,
    generatedAt: now.toISOString(),
    scope,
    programIds: programs.map((program) => program.id),
    applicantIds: applicants.map((applicant) => applicant.id),
    reviewerIds: reviewers.map((reviewer) => reviewer.id),
    walletIds: wallets.map((wallet) => wallet.id),
    milestoneIds: milestones.map((milestone) => milestone.id),
    paymentIds: payments.map((payment) => payment.id),
    programs,
    applicants,
    reviewers,
    wallets,
    milestones,
    payments,
    syntheticIdentity: SYNTHETIC_IDENTITY,
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

export type SeedValidation = { ok: boolean; errors: string[] };

export function validateSeedRun(run: SeedRun): SeedValidation {
  const errors: string[] = [];

  const replayed = generateSeedRun({ seedKey: run.seedKey, environment: run.environment });
  if (replayed.runId !== run.runId) {
    errors.push('Run ID is not deterministic — regeneration from the same seed key differs.');
  }
  if (replayed.programIds.join(',') !== run.programIds.join(',')) {
    errors.push('Generated records are not deterministic for the given seed key.');
  }

  if (!run.syntheticIdentity) {
    errors.push('Seed runs must use synthetic identity only.');
  }

  const uniqueIds = new Set([
    ...run.programIds,
    ...run.applicantIds,
    ...run.reviewerIds,
    ...run.walletIds,
    ...run.milestoneIds,
    ...run.paymentIds,
  ]);
  if (uniqueIds.size !== run.programIds.length + run.applicantIds.length + run.reviewerIds.length + run.walletIds.length + run.milestoneIds.length + run.paymentIds.length) {
    errors.push('Created IDs are not globally unique.');
  }

  for (const wallet of run.wallets) {
    if (!/^[GS][A-HJ-NP-Z2-9]{55}$/.test(wallet.address)) {
      errors.push(`Wallet ${wallet.id} is not a valid 56-character Stellar testnet address.`);
    }
  }

  for (const milestone of run.milestones) {
    if (!run.programIds.includes(milestone.programId)) {
      errors.push(`Milestone ${milestone.id} references an unknown program.`);
    }
  }
  for (const payment of run.payments) {
    if (!run.milestones.some((milestone) => milestone.id === payment.milestoneId)) {
      errors.push(`Payment ${payment.id} references an unknown milestone.`);
    }
  }

  return { ok: errors.length === 0, errors };
}

// ─── Reversibility / rollback manifest ────────────────────────────────────────

export function buildRollbackManifest(run: SeedRun, revokedAt?: string): RollbackManifest {
  return {
    runId: run.runId,
    seedKey: run.seedKey,
    environments: [run.environment],
    createdIds: [
      ...run.programIds,
      ...run.applicantIds,
      ...run.reviewerIds,
      ...run.walletIds,
      ...run.milestoneIds,
      ...run.paymentIds,
    ],
    revokedAt,
  };
}

// ─── API service ──────────────────────────────────────────────────────────────

export const scholarshipSeedService = {
  create: (payload: { seedKey: string; environment: SeedEnvironment; scope?: SeedScope }): Promise<SeedRun> =>
    apiClient.post<SeedRun>('/scholarships/staging/seed-runs', payload),

  get: (runId: string): Promise<SeedRun> => apiClient.get<SeedRun>(`/scholarships/staging/seed-runs/${runId}`),

  revoke: (runId: string): Promise<RollbackManifest> =>
    apiClient.post<RollbackManifest>(`/scholarships/staging/seed-runs/${runId}/revoke`, {}),
};