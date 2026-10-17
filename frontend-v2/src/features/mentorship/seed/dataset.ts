/**
 * Deterministic mentorship seed data (closes #1254, MENTOR-007).
 *
 * A single seeded dataset that makes every mentorship flow demonstrable in
 * local development and tests: enrollments, matching, sessions, deliverables,
 * settlement, and disputes - including the sparse, edge, and terminal states
 * that an empty environment would otherwise never show.
 *
 * Properties the issue requires:
 *
 * 1. **Deterministic.** The same `seed` value always produces a deep-equal
 *    dataset (fixed PRNG, fixed timestamps).
 * 2. **Reset leaves no global state.** `clearPersistedMentorshipState`
 *    removes every `chainverse-mentorship-` key from local storage;
 *    `resetMentorshipSeedData` clears and rebuilds in one step.
 * 3. **No real personal data.** Display names come from fixed synthetic
 *    pools, no emails are stored, and every actor key is opaque.
 * 4. **Consistent with the vocabulary.** Identifiers are built with the
 *    MENTOR-001 helpers, payments use MENTOR-006 money, and engagement
 *    statuses draw on every state of the MENTOR-004 machine.
 */

import {
  type EngagementState,
  type PaymentState,
  type DisputeState,
  type SessionState,
  type DeliverableState,
  isMentorshipId,
  mentorshipId,
} from '../glossary';

export const MENTORSHIP_SEED_VERSION = '1.0.0' as const;

/** Storage-key prefix owned by the mentorship feature's persisted state. */
export const MENTORSHIP_STORAGE_PREFIX = 'chainverse-mentorship-';

export interface MentorshipSeedOptions {
  /** Any integer; the same value always rebuilds the same dataset. */
  seed: number;
  organizations?: number;
  mentorsPerOrganization?: number;
  menteesPerOrganization?: number;
  programsPerOrganization?: number;
}

export interface SeedOrganization {
  id: string;
  name: string;
}

export interface SeedMentor {
  id: string;
  displayName: string;
  organizationId: string;
  expertise: string;
}

export interface SeedMentee {
  id: string;
  displayName: string;
  organizationId: string;
  learningGoal: string;
}

export interface SeedProgram {
  id: string;
  name: string;
  organizationId: string;
  currency: 'XLM' | 'USDC';
}

export interface SeedEngagement {
  id: string;
  status: EngagementState;
  mentorId: string;
  menteeId: string;
  programId: string;
  startedAt: string;
  endedAt?: string;
}

export interface SeedPayment {
  id: string;
  status: PaymentState;
  engagementId: string;
  amountMinorUnits: number;
  currency: 'XLM' | 'USDC';
}

export interface SeedDispute {
  id: string;
  status: DisputeState;
  engagementId: string;
  reason: string;
}

export interface MentorshipSeedDataset {
  version: typeof MENTORSHIP_SEED_VERSION;
  seed: number;
  organizations: SeedOrganization[];
  mentors: SeedMentor[];
  mentees: SeedMentee[];
  programs: SeedProgram[];
  engagements: SeedEngagement[];
  payments: SeedPayment[];
  disputes: SeedDispute[];
}

const SYNTHETIC_FIRST_NAMES = ['Ada', 'Kwame', 'Zola', 'Tariq', 'Ines', 'Mikael', 'Sana', 'Dmitri'];
const SYNTHETIC_LAST_NAMES = ['Okafor', 'Mensah', 'Novak', 'Haddad', 'Larsen', 'Tanaka', 'Ncube', 'Reyes'];
const EXPERTISE_POOL = ['solidity', 'data-analysis', 'grant-writing', 'frontend', 'security-auditing'];
const LEARNING_GOALS = ['firstMvcContract', 'dashboard-analytics', 'hackathon-readiness', 'code-review-practice'];

/** Fixed ISO instants keep the dataset byte-identical across rebuilds. */
const FIXED_DAYS = [
  '2026-01-12T09:00:00.000Z',
  '2026-02-02T09:00:00.000Z',
  '2026-03-16T09:00:00.000Z',
  '2026-04-06T09:00:00.000Z',
];

/** Deterministic PRNG (mulberry32); no runtime dependency. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(random: () => number, pool: readonly T[]): T {
  return pool[Math.floor(random() * pool.length)];
}

/** Engagement states chosen so sparse and terminal views are demonstrable. */
const ENGAGEMENT_SEED_STATUSES: readonly EngagementState[] = [
  'proposed',
  'accepted',
  'active',
  'active',
  'completed',
  'declined',
  'withdrawn',
  'cancelled',
  'disputed',
];

const PAYMENT_SEED_STATUSES: readonly PaymentState[] = [
  'quoted',
  'authorized',
  'captured',
  'settled',
  'voided',
];

const DISPUTE_SEED_STATUSES: readonly DisputeState[] = ['opened', 'under-review', 'escalated', 'resolved'];

const SESSION_SEED_STATUSES: readonly SessionState[] = [
  'scheduled',
  'confirmed',
  'in-progress',
  'completed',
  'no-show',
];

const DELIVERABLE_SEED_STATUSES: readonly DeliverableState[] = ['draft', 'submitted', 'accepted'];
export { SESSION_SEED_STATUSES, DELIVERABLE_SEED_STATUSES };

export interface SeedSession {
  id: string;
  status: SessionState;
  engagementId: string;
  scheduledAt: string;
}

export interface SeedDeliverable {
  id: string;
  status: DeliverableState;
  engagementId: string;
  title: string;
}

export interface ExtendedMentorshipSeedDataset extends MentorshipSeedDataset {
  sessions: SeedSession[];
  deliverables: SeedDeliverable[];
}

/**
 * Builds the deterministic dataset. Every id is opaque, formed from the
 * MENTOR-001 helpers (`eng_<key>`, `pay_<key>`, ...), never from a name.
 */
export function buildMentorshipSeedDataset(
  options: MentorshipSeedOptions,
): ExtendedMentorshipSeedDataset {
  const random = mulberry32(options.seed);
  const organizations = Math.max(1, options.organizations ?? 2);
  // Default: nine (one per ENGAGEMENT_SEED_STATUSES entry) so a single
  // organization already demonstrates every engagement state, including the
  // disputed and cancelled edge cases.
  const mentorsPerOrg = options.mentorsPerOrganization ?? 9;
  const menteesPerOrg = Math.max(1, options.menteesPerOrganization ?? 4);
  const programsPerOrg = Math.max(1, options.programsPerOrganization ?? 2);

  const orgs: SeedOrganization[] = [];
  const mentors: SeedMentor[] = [];
  const mentees: SeedMentee[] = [];
  const programs: SeedProgram[] = [];
  const engagements: SeedEngagement[] = [];
  const sessions: SeedSession[] = [];
  const deliverables: SeedDeliverable[] = [];
  const payments: SeedPayment[] = [];
  const disputes: SeedDispute[] = [];

  let mentorIndex = 0;
  let menteeIndex = 0;
  let programIndex = 0;
  let engagementIndex = 0;
  let sessionIndex = 0;
  let deliverableIndex = 0;
  let paymentIndex = 0;
  let disputeIndex = 0;

  for (let org = 1; org <= organizations; org += 1) {
    const organizationId = `org_${org}`;
    orgs.push({
      id: organizationId,
      name: `Support Collective ${org}`,
    });

    for (let m = 0; m < mentorsPerOrg; m += 1) {
      mentorIndex += 1;
      mentors.push({
        id: mentorshipId('mentor', `seed-mtr-${organizationId}-${m}`),
        displayName: `${SYNTHETIC_FIRST_NAMES[(mentorIndex - 1) % SYNTHETIC_FIRST_NAMES.length]} ${
          SYNTHETIC_LAST_NAMES[(mentorIndex - 1) % SYNTHETIC_LAST_NAMES.length]
        }`,
        organizationId,
        expertise: pick(random, EXPERTISE_POOL),
      });
    }

    for (let t = 0; t < menteesPerOrg; t += 1) {
      menteeIndex += 1;
      mentees.push({
        id: mentorshipId('mentee', `seed-mte-${organizationId}-${t}`),
        displayName: `${SYNTHETIC_FIRST_NAMES[(menteeIndex + 2) % SYNTHETIC_FIRST_NAMES.length]} ${
          SYNTHETIC_LAST_NAMES[(menteeIndex + 3) % SYNTHETIC_LAST_NAMES.length]
        }`,
        organizationId,
        learningGoal: pick(random, LEARNING_GOALS),
      });
    }

    for (let p = 0; p < programsPerOrg; p += 1) {
      programIndex += 1;
      programs.push({
        id: mentorshipId('program', `seed-prg-${organizationId}-${p}`),
        name: `Mentorship Track ${programIndex}`,
        organizationId,
        currency: random() > 0.5 ? 'XLM' : 'USDC',
      });
    }

    const orgMentors = mentors.filter((mentor) => mentor.organizationId === organizationId);
    const orgMentees = mentees.filter((mentee) => mentee.organizationId === organizationId);
    const orgPrograms = programs.filter((program) => program.organizationId === organizationId);

    orgMentors.forEach((mentor, mentorPosition) => {
      const mentee = orgMentees[(mentorPosition + Math.floor(random() * orgMentees.length)) % orgMentees.length];
      const program = orgPrograms[mentorPosition % orgPrograms.length];
      engagementIndex += 1;
      const status = ENGAGEMENT_SEED_STATUSES[(engagementIndex - 1) % ENGAGEMENT_SEED_STATUSES.length];
      const startedAt = FIXED_DAYS[(engagementIndex - 1) % FIXED_DAYS.length];
      const engagementId = `seed-eng-${engagementIndex}`;
      engagements.push({
        id: mentorshipId('engagement', engagementId),
        status,
        mentorId: mentor.id,
        menteeId: mentee.id,
        programId: program.id,
        startedAt,
        endedAt:
          status === 'completed' || status === 'cancelled'
            ? new Date(Date.parse(startedAt) + 30 * 86_400_000).toISOString()
            : undefined,
      });

      // One session and one deliverable per engagement keeps the dataset
      // small while still exercising the per-aggregate states.
      sessionIndex += 1;
      sessions.push({
        id: mentorshipId('session', `seed-ses-${sessionIndex}`),
        status: SESSION_SEED_STATUSES[(sessionIndex - 1) % SESSION_SEED_STATUSES.length],
        engagementId: mentorshipId('engagement', engagementId),
        scheduledAt: FIXED_DAYS[(sessionIndex - 1) % FIXED_DAYS.length],
      });
      deliverableIndex += 1;
      deliverables.push({
        id: mentorshipId('deliverable', `seed-dlv-${deliverableIndex}`),
        status: DELIVERABLE_SEED_STATUSES[(deliverableIndex - 1) % DELIVERABLE_SEED_STATUSES.length],
        engagementId: mentorshipId('engagement', engagementId),
        title: `Portfolio review ${deliverableIndex}`,
      });

      // Payments exist for the settled-money demo states.
      if (status === 'active' || status === 'completed' || status === 'disputed') {
        paymentIndex += 1;
        payments.push({
          id: mentorshipId('payment', `seed-pay-${paymentIndex}`),
          status: PAYMENT_SEED_STATUSES[(paymentIndex - 1) % PAYMENT_SEED_STATUSES.length],
          engagementId: mentorshipId('engagement', engagementId),
          amountMinorUnits: 1000000 + paymentIndex * 250000,
          currency: program.currency,
        });
      }

      if (status === 'disputed') {
        disputeIndex += 1;
        disputes.push({
          id: mentorshipId('dispute', `seed-dsp-${disputeIndex}`),
          status: DISPUTE_SEED_STATUSES[(disputeIndex - 1) % DISPUTE_SEED_STATUSES.length],
          engagementId: mentorshipId('engagement', engagementId),
          reason: 'Seed scenario: mentor requested a session reschedule the mentee rejected.',
        });
      }
    });
  }

  return {
    version: MENTORSHIP_SEED_VERSION,
    seed: options.seed,
    organizations: orgs,
    mentors,
    mentees,
    programs,
    engagements,
    sessions,
    deliverables,
    payments,
    disputes,
  };
}

/** Removes every persisted mentorship key; test-only storage can be injected. */
export function clearPersistedMentorshipState(
  storage?: Pick<Storage, 'length' | 'key' | 'removeItem'>,
): void {
  const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!target) return;
  const doomed: string[] = [];
  for (let index = 0; index < target.length; index += 1) {
    const key = target.key(index);
    if (key && key.startsWith(MENTORSHIP_STORAGE_PREFIX)) {
      doomed.push(key);
    }
  }
  for (const key of doomed) {
    target.removeItem(key);
  }
}

/** Clears persisted mentorship state and rebuilds the default dataset. */
export function resetMentorshipSeedData(
  storage?: Pick<Storage, 'length' | 'key' | 'removeItem'>,
): ExtendedMentorshipSeedDataset {
  clearPersistedMentorshipState(storage);
  return buildMentorshipSeedDataset({ seed: 7 });
}

/** True when the dataset only contains synthetic, non-personal data. */
export function seedDataIsSynthetic(dataset: ExtendedMentorshipSeedDataset): boolean {
  const personalPool = [...SYNTHETIC_FIRST_NAMES, ...SYNTHETIC_LAST_NAMES];
  return [...dataset.mentors, ...dataset.mentees].every((entity) => {
    const parts = entity.displayName.split(' ');
    return parts.every((part) => personalPool.includes(part));
  });
}

/** Every engagement id in the dataset is a well-formed `eng_` identifier. */
export function engagementIdsAreWellFormed(dataset: ExtendedMentorshipSeedDataset): boolean {
  return dataset.engagements.every((engagement) => isMentorshipId('engagement', engagement.id));
}
