/**
 * Scholarship data retention and erasure policy (closes #1153).
 *
 * Records are classified, and each class carries a retention rule with a
 * stated legal basis. Two invariants are absolute and are encoded in the types
 * and the `assessRetention` order rather than left to operator discipline:
 *
 * 1. `financial` and `audit` records are never deletable. Breaking the audit
 *    chain or a settled disbursement is a worse outcome than retaining data
 *    past its nominal window.
 * 2. An active legal hold always wins, for every class including drafts.
 */

export type RecordClass =
  | 'draft'
  | 'rejected'
  | 'withdrawn'
  | 'awarded'
  | 'financial'
  | 'audit'
  | 'legal-hold';

export type RetentionRule = {
  recordClass: RecordClass;
  retentionDays: number | null;
  basis: 'contractual' | 'legal' | 'operational';
  legalBasis: string;
  deletable: boolean;
  owner: string;
};

export type RetentionPolicy = {
  version: string;
  rules: RetentionRule[];
  updatedAt: string;
  approvedBy: string;
};

export type LegalHold = {
  id: string;
  subjectId: string;
  scope: RecordClass[];
  reason: string;
  placedAt: string;
  placedBy: string;
  releasedAt?: string;
};

export type RetentionAssessment = {
  recordId: string;
  recordClass: RecordClass;
  action: 'retain' | 'expire' | 'delete' | 'blocked-by-hold' | 'blocked-immutable';
  reason: string;
  retentionDaysRemaining: number | null;
  protectedBy: 'legal-hold' | 'financial-integrity' | 'audit-integrity' | null;
};

export type ErasurePlan = {
  applicantId: string;
  deletable: string[];
  protected: { recordId: string; class: RecordClass; basis: RetentionRule['basis'] }[];
  blockedByHolds: string[];
};

export type RetentionRecord = {
  id: string;
  applicantId: string;
  class: RecordClass;
  createdAt: string;
  lastTouchedAt?: string;
};
