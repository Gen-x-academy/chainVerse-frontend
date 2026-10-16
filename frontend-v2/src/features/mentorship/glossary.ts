/**
 * Mentorship bounded contexts and shared vocabulary (closes #1248, MENTOR-001).
 *
 * This module is the single, versioned source of truth for the words the
 * mentorship feature uses. Every aggregate — mentor, mentee, program,
 * engagement, session, deliverable, payment, dispute — has:
 *
 * 1. a canonical term with a stable id prefix (identifiers are never derived
 *    from display text);
 * 2. an owner, so it is always clear which team may change it;
 * 3. a lifecycle with an explicit transition table, so an invalid transition is
 *    rejected by the same code the UI renders from; and
 * 4. a set of invariants that must hold regardless of which surface mutated an
 *    aggregate.
 *
 * The vocabulary is versioned: a persisted engagement records the
 * `MENTORSHIP_VOCABULARY_VERSION` it was created with, so a wording change can
 * never silently reinterpret an in-flight record.
 */

export const MENTORSHIP_VOCABULARY_VERSION = '1.0.0' as const;

export const MENTORSHIP_AGGREGATES = [
  'mentor',
  'mentee',
  'program',
  'engagement',
  'session',
  'deliverable',
  'payment',
  'dispute',
] as const;

export type MentorshipAggregate = (typeof MENTORSHIP_AGGREGATES)[number];

/** OP-1. Ownership boundaries: one accountable owner per aggregate. */
export type OwnershipBoundary = {
  aggregate: MentorshipAggregate;
  /** Team accountable for the aggregate's schema and lifecycle. */
  owner: string;
  /** The role that may author changes; enforcement lives in `./rbac`. */
  authoringRole: string;
  /** Data that must never leave the aggregate's privacy boundary. */
  restrictedFields: readonly string[];
};

export const MENTORSHIP_OWNERSHIP: readonly OwnershipBoundary[] = [
  {
    aggregate: 'mentor',
    owner: 'identity-platform',
    authoringRole: 'mentor',
    restrictedFields: ['governmentId', 'verificationEvidenceRef'],
  },
  {
    aggregate: 'mentee',
    owner: 'identity-platform',
    authoringRole: 'mentee',
    restrictedFields: ['accessibilityNeeds', 'matchingPreferences'],
  },
  {
    aggregate: 'program',
    owner: 'mentorship-operations',
    authoringRole: 'organization-staff',
    restrictedFields: ['internalBudgetCents'],
  },
  {
    aggregate: 'engagement',
    owner: 'mentorship-operations',
    authoringRole: 'organization-staff',
    restrictedFields: ['internalNotes'],
  },
  {
    aggregate: 'session',
    owner: 'mentorship-operations',
    authoringRole: 'mentor',
    restrictedFields: ['privateRecordingRef'],
  },
  {
    aggregate: 'deliverable',
    owner: 'mentorship-operations',
    authoringRole: 'mentee',
    restrictedFields: [],
  },
  {
    aggregate: 'payment',
    owner: 'finance',
    authoringRole: 'finance',
    restrictedFields: ['payoutAccountRef'],
  },
  {
    aggregate: 'dispute',
    owner: 'trust-and-safety',
    authoringRole: 'moderator',
    restrictedFields: ['reporterIdentity'],
  },
];

/** OP-2. Canonical terms. An alias is a convenience, never a stored value. */
export type GlossaryTerm = {
  term: string;
  aggregate: MentorshipAggregate;
  definition: string;
  /** Stable, opaque identifier prefix; ids are never built from display text. */
  idPrefix: string;
  aliases?: readonly string[];
};

export const MENTORSHIP_GLOSSARY: readonly GlossaryTerm[] = [
  {
    term: 'Mentor',
    aggregate: 'mentor',
    definition:
      'A verified practitioner who delivers 1-on-1 guidance and whose eligibility is backed by an identity verification.',
    idPrefix: 'mtr',
    aliases: ['tutor'],
  },
  {
    term: 'Mentee',
    aggregate: 'mentee',
    definition:
      'A learner who participates in an engagement and owns their learning profile and matching preferences.',
    idPrefix: 'mte',
    aliases: ['student'],
  },
  {
    term: 'Program',
    aggregate: 'program',
    definition:
      'A bounded offering that groups mentors, a curriculum, supported currencies, and scheduling policy.',
    idPrefix: 'prg',
  },
  {
    term: 'Engagement',
    aggregate: 'engagement',
    definition:
      'An accepted commitment between one mentor and one mentee under a program, spanning a start and end date.',
    idPrefix: 'eng',
  },
  {
    term: 'Session',
    aggregate: 'session',
    definition:
      'A single scheduled meeting within an engagement, with a duration, agenda, and attendance state.',
    idPrefix: 'ses',
  },
  {
    term: 'Deliverable',
    aggregate: 'deliverable',
    definition:
      'A tracked artefact a mentee submits for review within an engagement; acceptance gates settlement.',
    idPrefix: 'dlv',
  },
  {
    term: 'Payment',
    aggregate: 'payment',
    definition:
      'The smart-contract-backed settlement of an engagement, always expressed in integer minor units with a currency.',
    idPrefix: 'pay',
  },
  {
    term: 'Dispute',
    aggregate: 'dispute',
    definition:
      'A formal disagreement raised against an engagement, session, or payment, resolved by a moderator.',
    idPrefix: 'dsp',
  },
];

/** Canonicalise a free-text term to its glossary entry, if one exists. */
export function resolveGlossaryTerm(input: string): GlossaryTerm | undefined {
  const needle = input.trim().toLowerCase();
  if (!needle) return undefined;
  return MENTORSHIP_GLOSSARY.find(
    (entry) =>
      entry.term.toLowerCase() === needle ||
      (entry.aliases ?? []).some((alias) => alias.toLowerCase() === needle),
  );
}

/** Every alias resolves to exactly one canonical term. */
export function glossaryAliasesAreUnique(
  glossary: readonly GlossaryTerm[] = MENTORSHIP_GLOSSARY,
): boolean {
  const seen = new Set<string>();
  for (const entry of glossary) {
    for (const word of [entry.term, ...(entry.aliases ?? [])]) {
      const key = word.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
    }
  }
  return true;
}

/** OP-4. Identifiers: `mtr_<opaque>` — never a name, email, or index. */
export function mentorshipId(aggregate: MentorshipAggregate, opaque: string): string {
  const entry = MENTORSHIP_GLOSSARY.find((item) => item.aggregate === aggregate);
  if (!entry) throw new Error(`Unknown mentorship aggregate: ${String(aggregate)}`);
  const trimmed = opaque.trim();
  if (!trimmed) throw new Error(`A ${aggregate} id needs an opaque value.`);
  return `${entry.idPrefix}_${trimmed}`;
}

export function isMentorshipId(aggregate: MentorshipAggregate, value: string): boolean {
  const entry = MENTORSHIP_GLOSSARY.find((item) => item.aggregate === aggregate);
  if (!entry) return false;
  return new RegExp(`^${entry.idPrefix}_[A-Za-z0-9-]+$`).test(value);
}

// ─── OP-3. Lifecycle states and transitions ───────────────────────────────────

export type MentorState = 'applicant' | 'verified' | 'active' | 'suspended' | 'retired';
export type MenteeState = 'invited' | 'active' | 'paused' | 'completed';
export type ProgramState = 'draft' | 'published' | 'enrolling' | 'active' | 'completed' | 'archived';
export type EngagementState =
  | 'proposed'
  | 'accepted'
  | 'active'
  | 'completed'
  | 'declined'
  | 'withdrawn'
  | 'cancelled'
  | 'disputed';
export type SessionState =
  | 'scheduled'
  | 'confirmed'
  | 'in-progress'
  | 'completed'
  | 'no-show'
  | 'cancelled';
export type DeliverableState = 'draft' | 'submitted' | 'revision-requested' | 'accepted';
export type PaymentState = 'quoted' | 'authorized' | 'captured' | 'settled' | 'voided' | 'refunded';
export type DisputeState = 'opened' | 'under-review' | 'escalated' | 'resolved';

export type MentorshipState =
  | MentorState
  | MenteeState
  | ProgramState
  | EngagementState
  | SessionState
  | DeliverableState
  | PaymentState
  | DisputeState;

export type MentorshipLifecycle = {
  states: readonly MentorshipState[];
  initial: MentorshipState;
  transitions: Readonly<Record<string, readonly MentorshipState[]>>;
};

/**
 * One lifecycle per aggregate. A state absent from `transitions` is terminal;
 * a state mapped to an empty array is terminal and explicit.
 */
export const MENTORSHIP_LIFECYCLES: Readonly<Record<MentorshipAggregate, MentorshipLifecycle>> = {
  mentor: {
    states: ['applicant', 'verified', 'active', 'suspended', 'retired'],
    initial: 'applicant',
    transitions: {
      applicant: ['verified'],
      verified: ['active'],
      active: ['suspended', 'retired'],
      suspended: ['active', 'retired'],
      retired: [],
    },
  },
  mentee: {
    states: ['invited', 'active', 'paused', 'completed'],
    initial: 'invited',
    transitions: {
      invited: ['active'],
      active: ['paused', 'completed'],
      paused: ['active', 'completed'],
      completed: [],
    },
  },
  program: {
    states: ['draft', 'published', 'enrolling', 'active', 'completed', 'archived'],
    initial: 'draft',
    transitions: {
      draft: ['published'],
      published: ['enrolling', 'archived'],
      enrolling: ['active', 'archived'],
      active: ['completed'],
      completed: ['archived'],
      archived: [],
    },
  },
  engagement: {
    states: [
      'proposed',
      'accepted',
      'active',
      'completed',
      'declined',
      'withdrawn',
      'cancelled',
      'disputed',
    ],
    initial: 'proposed',
    transitions: {
      proposed: ['accepted', 'declined', 'withdrawn'],
      accepted: ['active', 'withdrawn'],
      active: ['completed', 'cancelled', 'disputed'],
      disputed: ['active', 'cancelled', 'completed'],
      completed: [],
      declined: [],
      withdrawn: [],
      cancelled: [],
    },
  },
  session: {
    states: ['scheduled', 'confirmed', 'in-progress', 'completed', 'no-show', 'cancelled'],
    initial: 'scheduled',
    transitions: {
      scheduled: ['confirmed', 'cancelled'],
      confirmed: ['in-progress', 'no-show', 'cancelled'],
      'in-progress': ['completed'],
      completed: [],
      'no-show': [],
      cancelled: [],
    },
  },
  deliverable: {
    states: ['draft', 'submitted', 'revision-requested', 'accepted'],
    initial: 'draft',
    transitions: {
      draft: ['submitted'],
      submitted: ['accepted', 'revision-requested'],
      'revision-requested': ['submitted'],
      accepted: [],
    },
  },
  payment: {
    states: ['quoted', 'authorized', 'captured', 'settled', 'voided', 'refunded'],
    initial: 'quoted',
    transitions: {
      quoted: ['authorized'],
      authorized: ['captured', 'voided'],
      captured: ['settled', 'refunded'],
      settled: [],
      voided: [],
      refunded: [],
    },
  },
  dispute: {
    states: ['opened', 'under-review', 'escalated', 'resolved'],
    initial: 'opened',
    transitions: {
      opened: ['under-review'],
      'under-review': ['escalated', 'resolved'],
      escalated: ['resolved'],
      resolved: [],
    },
  },
};

export type MentorshipTransitionErrorCode = 'UNKNOWN_STATE' | 'ILLEGAL_TRANSITION';

export type MentorshipTransitionError = {
  code: MentorshipTransitionErrorCode;
  aggregate: MentorshipAggregate;
  from: string;
  to: string;
  message: string;
};

export type MentorshipTransitionResult =
  | { ok: true; state: MentorshipState }
  | { ok: false; error: MentorshipTransitionError };

/**
 * Evaluates a transition against the aggregate's table. Re-entering the same
 * state is a harmless no-op; anything else must be listed explicitly, so an
 * unlisted pair is always rejected with a stable, actionable message.
 */
export function evaluateMentorshipTransition(
  aggregate: MentorshipAggregate,
  from: MentorshipState,
  to: MentorshipState,
): MentorshipTransitionResult {
  const lifecycle = MENTORSHIP_LIFECYCLES[aggregate];

  if (!lifecycle.states.includes(from) || !lifecycle.states.includes(to)) {
    return {
      ok: false,
      error: {
        code: 'UNKNOWN_STATE',
        aggregate,
        from,
        to,
        message: `Unknown ${aggregate} state: "${from}" or "${to}".`,
      },
    };
  }

  if (from === to) return { ok: true, state: to };

  if ((lifecycle.transitions[from] ?? []).includes(to)) {
    return { ok: true, state: to };
  }

  return {
    ok: false,
    error: {
      code: 'ILLEGAL_TRANSITION',
      aggregate,
      from,
      to,
      message: `Cannot move ${aggregate} from "${from}" to "${to}".`,
    },
  };
}

export function isTerminalMentorshipState(
  aggregate: MentorshipAggregate,
  state: MentorshipState,
): boolean {
  const lifecycle = MENTORSHIP_LIFECYCLES[aggregate];
  if (!lifecycle.states.includes(state)) return false;
  return (lifecycle.transitions[state] ?? []).length === 0;
}

// ─── OP-5. Invariants ─────────────────────────────────────────────────────────

export type MentorshipInvariant = {
  id: string;
  aggregate: MentorshipAggregate;
  description: string;
};

export const MENTORSHIP_INVARIANTS: readonly MentorshipInvariant[] = [
  {
    id: 'MENTOR-001-01',
    aggregate: 'session',
    description: 'A session must reference an engagement that is already accepted or active.',
  },
  {
    id: 'MENTOR-001-02',
    aggregate: 'session',
    description: 'A mentor and mentee must be distinct principals on every session.',
  },
  {
    id: 'MENTOR-001-03',
    aggregate: 'payment',
    description: 'A payment can only be authorized against an accepted engagement.',
  },
  {
    id: 'MENTOR-001-04',
    aggregate: 'deliverable',
    description:
      'An engagement cannot complete until every required deliverable is accepted.',
  },
  {
    id: 'MENTOR-001-05',
    aggregate: 'dispute',
    description: 'A dispute freezes settlement: a payment cannot move to settled while a dispute is open.',
  },
];

export type MentorshipInvariantInput = {
  engagementState?: EngagementState;
  sessionMentorId?: string;
  sessionMenteeId?: string;
  paymentState?: PaymentState;
  requiredDeliverablesAccepted?: boolean;
  openDisputes?: number;
};

export type MentorshipInvariantViolation = {
  id: string;
  aggregate: MentorshipAggregate;
  message: string;
};

/**
 * Checks every invariant the supplied input has enough information for. Fields
 * that are absent are simply not evaluated — callers pass the data they hold
 * and the function stays pure and deterministic.
 */
export function validateMentorshipInvariants(
  input: MentorshipInvariantInput,
): MentorshipInvariantViolation[] {
  const violations: MentorshipInvariantViolation[] = [];

  if (input.engagementState !== undefined) {
    const usable = input.engagementState === 'accepted' || input.engagementState === 'active';
    if (input.sessionMentorId !== undefined && !usable) {
      violations.push({
        id: 'MENTOR-001-01',
        aggregate: 'session',
        message: `Sessions require an accepted or active engagement (got "${input.engagementState}").`,
      });
    }
    if (input.paymentState === 'authorized' && input.engagementState !== 'accepted') {
      violations.push({
        id: 'MENTOR-001-03',
        aggregate: 'payment',
        message: `Payment authorization requires an accepted engagement (got "${input.engagementState}").`,
      });
    }
  }

  if (
    input.sessionMentorId !== undefined &&
    input.sessionMenteeId !== undefined &&
    input.sessionMentorId === input.sessionMenteeId
  ) {
    violations.push({
      id: 'MENTOR-001-02',
      aggregate: 'session',
      message: 'A mentor cannot be their own mentee on a session.',
    });
  }

  if (input.requiredDeliverablesAccepted === false) {
    violations.push({
      id: 'MENTOR-001-04',
      aggregate: 'deliverable',
      message: 'Required deliverables must be accepted before the engagement completes.',
    });
  }

  if ((input.openDisputes ?? 0) > 0 && input.paymentState === 'settled') {
    violations.push({
      id: 'MENTOR-001-05',
      aggregate: 'dispute',
      message: 'A payment cannot settle while a dispute is open.',
    });
  }

  return violations;
}

/**
 * The complete happy path, used by documentation, fixtures, and the end-to-end
 * smoke test. Each step names the aggregate and the transition it performs.
 */
export const MENTORSHIP_HAPPY_PATH: readonly { aggregate: MentorshipAggregate; from: MentorshipState; to: MentorshipState }[] = [
  { aggregate: 'program', from: 'draft', to: 'published' },
  { aggregate: 'program', from: 'published', to: 'enrolling' },
  { aggregate: 'program', from: 'enrolling', to: 'active' },
  { aggregate: 'mentor', from: 'applicant', to: 'verified' },
  { aggregate: 'mentor', from: 'verified', to: 'active' },
  { aggregate: 'mentee', from: 'invited', to: 'active' },
  { aggregate: 'engagement', from: 'proposed', to: 'accepted' },
  { aggregate: 'engagement', from: 'accepted', to: 'active' },
  { aggregate: 'session', from: 'scheduled', to: 'confirmed' },
  { aggregate: 'session', from: 'confirmed', to: 'in-progress' },
  { aggregate: 'session', from: 'in-progress', to: 'completed' },
  { aggregate: 'deliverable', from: 'draft', to: 'submitted' },
  { aggregate: 'deliverable', from: 'submitted', to: 'accepted' },
  { aggregate: 'engagement', from: 'active', to: 'completed' },
  { aggregate: 'payment', from: 'quoted', to: 'authorized' },
  { aggregate: 'payment', from: 'authorized', to: 'captured' },
  { aggregate: 'payment', from: 'captured', to: 'settled' },
];

/** Every step of the happy path must be a legal transition. */
export function happyPathIsValid(): boolean {
  return MENTORSHIP_HAPPY_PATH.every(
    (step) => evaluateMentorshipTransition(step.aggregate, step.from, step.to).ok,
  );
}

/**
 * Optional remote glossary fetch. The client ships the canonical glossary, so
 * a failure degrades to the local copy rather than blocking the UI.
 */
export const mentorshipGlossaryService = {
  get: async (): Promise<{ version: string; terms: readonly GlossaryTerm[] }> => {
    const { apiClient } = await import('@/src/lib/api-client');
    try {
      const remote = await apiClient.get<{ version: string; terms: GlossaryTerm[] }>(
        '/mentorship/glossary',
      );
      if (remote && Array.isArray(remote.terms)) return remote;
    } catch {
      // fall through to the bundled vocabulary
    }
    return { version: MENTORSHIP_VOCABULARY_VERSION, terms: MENTORSHIP_GLOSSARY };
  },
};
