/**
 * Deterministic, isolated fixtures for scholarship tests (issues #1168, #1169).
 *
 * Fixtures are built per call so a test never mutates another test's data, and
 * the in-memory store gives persistence tests a disposable backing store instead
 * of shared mutable external state. This module is test-only and is intentionally
 * not re-exported from the feature barrel.
 */

import type {
  ApplicationState,
  AwardState,
  MilestoneState,
  PaymentState,
  ProgramState,
} from '../domain';

export type FixtureProgram = { id: string; title: string; state: ProgramState };
export type FixtureApplication = {
  id: string;
  programId: string;
  applicantId: string;
  state: ApplicationState;
};
export type FixtureAward = { id: string; applicationId: string; amount: number; state: AwardState };
export type FixtureMilestone = {
  id: string;
  awardId: string;
  order: number;
  title: string;
  state: MilestoneState;
};
export type FixturePayment = { id: string; milestoneId: string; amount: number; state: PaymentState };

export type FixtureSet = {
  programs: FixtureProgram[];
  applications: FixtureApplication[];
  awards: FixtureAward[];
  milestones: FixtureMilestone[];
  payments: FixturePayment[];
};

export function createFixtureSet(prefix = 'fixture'): FixtureSet {
  const programId = `${prefix}-program-1`;
  const applicationId = `${prefix}-application-1`;
  const awardId = `${prefix}-award-1`;
  const milestoneId = `${prefix}-milestone-1`;

  return {
    programs: [{ id: programId, title: 'Foundations scholarship', state: 'published' }],
    applications: [
      { id: applicationId, programId, applicantId: `${prefix}-student-1`, state: 'submitted' },
    ],
    awards: [{ id: awardId, applicationId, amount: 500, state: 'offered' }],
    milestones: [{ id: milestoneId, awardId, order: 1, title: 'Course completion', state: 'pending' }],
    payments: [{ id: `${prefix}-payment-1`, milestoneId, amount: 500, state: 'intent' }],
  };
}

export type InMemoryStore<T extends { id: string }> = {
  save: (item: T) => T;
  get: (id: string) => T | undefined;
  list: () => T[];
  reset: () => void;
};

/** Copies in and out so callers can never mutate stored records by reference. */
export function createInMemoryStore<T extends { id: string }>(): InMemoryStore<T> {
  const items = new Map<string, T>();

  return {
    save(item: T): T {
      const stored = { ...item };
      items.set(stored.id, stored);
      return { ...stored };
    },
    get(id: string): T | undefined {
      const found = items.get(id);
      return found ? { ...found } : undefined;
    },
    list(): T[] {
      return [...items.values()].map((item) => ({ ...item }));
    },
    reset(): void {
      items.clear();
    },
  };
}
