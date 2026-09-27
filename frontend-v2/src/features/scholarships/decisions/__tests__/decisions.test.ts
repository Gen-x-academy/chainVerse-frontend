import { describe, it, expect } from 'vitest';
import {
  canVote,
  canRecuse,
  hasQuorum,
  computeFinalDecision,
  validateVote,
  activeVoters,
} from '../domain';
import type { CommitteeDecision, VoteRecord } from '../types';

const BASE_DECISION: CommitteeDecision = {
  id: 'decision-001',
  applicationId: 'app-001',
  aggregateVersion: 'v1-2024-01',
  committee: [
    { userId: 'chair-001', role: 'chair', name: 'Dr. Chair' },
    { userId: 'member-001', role: 'member', name: 'Member One' },
    { userId: 'member-002', role: 'member', name: 'Member Two' },
    { userId: 'observer-001', role: 'observer', name: 'Observer' },
  ],
  votes: [],
  recusals: [],
  quorumPolicy: { minVotes: 2, requireChairVote: true },
  status: 'in_progress',
  createdAt: '2024-01-01T00:00:00Z',
};

describe('canVote', () => {
  it('allows a chair to vote', () => {
    expect(canVote(BASE_DECISION, 'chair-001').allowed).toBe(true);
  });

  it('allows a member to vote', () => {
    expect(canVote(BASE_DECISION, 'member-001').allowed).toBe(true);
  });

  it('denies an observer from voting', () => {
    const result = canVote(BASE_DECISION, 'observer-001');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/observer/i);
  });

  it('denies a recused member from voting', () => {
    const d: CommitteeDecision = {
      ...BASE_DECISION,
      recusals: [{ memberId: 'member-001', reason: 'conflict', recusedAt: '' }],
    };
    expect(canVote(d, 'member-001').allowed).toBe(false);
  });

  it('denies double voting', () => {
    const d: CommitteeDecision = {
      ...BASE_DECISION,
      votes: [
        {
          memberId: 'member-001',
          decision: 'award',
          rationale: 'Strong candidate',
          evidenceVersion: 'v1-2024-01',
          votedAt: '2024-01-10T00:00:00Z',
        },
      ],
    };
    expect(canVote(d, 'member-001').allowed).toBe(false);
  });

  it('denies voting on a decided decision', () => {
    const d: CommitteeDecision = { ...BASE_DECISION, status: 'decided' };
    expect(canVote(d, 'member-001').allowed).toBe(false);
  });

  it('denies voting on a voided decision', () => {
    const d: CommitteeDecision = { ...BASE_DECISION, status: 'voided' };
    expect(canVote(d, 'member-001').allowed).toBe(false);
  });

  it('returns reason for non-member', () => {
    const result = canVote(BASE_DECISION, 'unknown-user');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
  });
});

describe('canRecuse', () => {
  it('allows a member to recuse before voting', () => {
    expect(canRecuse(BASE_DECISION, 'member-001').allowed).toBe(true);
  });

  it('denies recusal after voting', () => {
    const d: CommitteeDecision = {
      ...BASE_DECISION,
      votes: [
        {
          memberId: 'member-001',
          decision: 'award',
          rationale: 'r',
          evidenceVersion: 'v1-2024-01',
          votedAt: '',
        },
      ],
    };
    expect(canRecuse(d, 'member-001').allowed).toBe(false);
  });

  it('denies double recusal', () => {
    const d: CommitteeDecision = {
      ...BASE_DECISION,
      recusals: [{ memberId: 'member-001', reason: 'conflict', recusedAt: '' }],
    };
    expect(canRecuse(d, 'member-001').allowed).toBe(false);
  });
});

describe('hasQuorum', () => {
  it('returns false with no votes', () => {
    expect(hasQuorum(BASE_DECISION, { minVotes: 2, requireChairVote: true })).toBe(false);
  });

  it('returns false when chair has not voted and requireChairVote is true', () => {
    const d: CommitteeDecision = {
      ...BASE_DECISION,
      votes: [
        { memberId: 'member-001', decision: 'award', rationale: 'r', evidenceVersion: 'v1-2024-01', votedAt: '' },
        { memberId: 'member-002', decision: 'award', rationale: 'r', evidenceVersion: 'v1-2024-01', votedAt: '' },
      ],
    };
    expect(hasQuorum(d, { minVotes: 2, requireChairVote: true })).toBe(false);
  });

  it('returns true when chair and one member have voted', () => {
    const d: CommitteeDecision = {
      ...BASE_DECISION,
      votes: [
        { memberId: 'chair-001', decision: 'award', rationale: 'r', evidenceVersion: 'v1-2024-01', votedAt: '' },
        { memberId: 'member-001', decision: 'award', rationale: 'r', evidenceVersion: 'v1-2024-01', votedAt: '' },
      ],
    };
    expect(hasQuorum(d, { minVotes: 2, requireChairVote: true })).toBe(true);
  });

  it('returns true without chair requirement when minVotes met', () => {
    const d: CommitteeDecision = {
      ...BASE_DECISION,
      votes: [
        { memberId: 'member-001', decision: 'award', rationale: 'r', evidenceVersion: 'v1-2024-01', votedAt: '' },
        { memberId: 'member-002', decision: 'shortlist', rationale: 'r', evidenceVersion: 'v1-2024-01', votedAt: '' },
      ],
    };
    expect(hasQuorum(d, { minVotes: 2, requireChairVote: false })).toBe(true);
  });
});

describe('computeFinalDecision', () => {
  it('returns majority decision', () => {
    const votes: VoteRecord[] = [
      { memberId: 'chair-001', decision: 'award', rationale: 'r', evidenceVersion: 'v1', votedAt: '' },
      { memberId: 'member-001', decision: 'award', rationale: 'r', evidenceVersion: 'v1', votedAt: '' },
      { memberId: 'member-002', decision: 'reject', rationale: 'r', evidenceVersion: 'v1', votedAt: '' },
    ];
    expect(computeFinalDecision(votes, BASE_DECISION.committee)).toBe('award');
  });

  it('breaks tie with chair vote', () => {
    const votes: VoteRecord[] = [
      { memberId: 'chair-001', decision: 'shortlist', rationale: 'r', evidenceVersion: 'v1', votedAt: '' },
      { memberId: 'member-001', decision: 'award', rationale: 'r', evidenceVersion: 'v1', votedAt: '' },
    ];
    expect(computeFinalDecision(votes, BASE_DECISION.committee)).toBe('shortlist');
  });

  it('breaks remaining tie alphabetically', () => {
    const votes: VoteRecord[] = [
      { memberId: 'member-001', decision: 'award', rationale: 'r', evidenceVersion: 'v1', votedAt: '' },
      { memberId: 'member-002', decision: 'reject', rationale: 'r', evidenceVersion: 'v1', votedAt: '' },
    ];
    const committee = BASE_DECISION.committee.filter((m) => m.role !== 'chair');
    expect(computeFinalDecision(votes, committee)).toBe('award');
  });
});

describe('validateVote', () => {
  it('returns no errors for a valid vote', () => {
    const errors = validateVote(
      { rationale: 'Strong academic record.', evidenceVersion: 'v1-2024-01' },
      BASE_DECISION
    );
    expect(errors).toHaveLength(0);
  });

  it('requires non-empty rationale', () => {
    const errors = validateVote(
      { rationale: '', evidenceVersion: 'v1-2024-01' },
      BASE_DECISION
    );
    expect(errors.some((e) => e.field === 'rationale')).toBe(true);
  });

  it('rejects mismatched evidence version', () => {
    const errors = validateVote(
      { rationale: 'Good.', evidenceVersion: 'v2-stale' },
      BASE_DECISION
    );
    expect(errors.some((e) => e.field === 'evidenceVersion')).toBe(true);
  });
});

describe('activeVoters', () => {
  it('excludes observers', () => {
    const voters = activeVoters(BASE_DECISION);
    expect(voters.every((v) => v.role !== 'observer')).toBe(true);
  });

  it('excludes recused members', () => {
    const d: CommitteeDecision = {
      ...BASE_DECISION,
      recusals: [{ memberId: 'member-001', reason: 'conflict', recusedAt: '' }],
    };
    const voters = activeVoters(d);
    expect(voters.some((v) => v.userId === 'member-001')).toBe(false);
  });

  it('includes unrecused members and chair', () => {
    const voters = activeVoters(BASE_DECISION);
    expect(voters.length).toBe(3);
  });
});
