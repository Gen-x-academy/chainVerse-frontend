// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  canAcceptInvitation,
  canPerformSponsorAction,
  createSponsorInvitation,
  acceptSponsorInvitation,
  filterInvitations,
  filterMembers,
  isInvitationExpired,
  removeSponsorMember,
  resendSponsorInvitation,
  revokeSponsorInvitation,
  updateSponsorMemberRole,
  validateInvitePayload,
} from '@/src/features/scholarships/sponsors/domain';
import {
  mockInvitations,
  mockSponsorOrg,
  mockTeamMembers,
} from '@/src/features/scholarships/sponsors/fixtures';
import type {
  SponsorInvitation,
  SponsorTeamMember,
} from '@/src/features/scholarships/sponsors/types';

describe('Sponsor Team Membership & Invitations Domain Logic', () => {
  const baseInviter = {
    id: 'user-elena-owner',
    name: 'Elena Rostova',
    email: 'elena.rostova@stellarimpact.org',
  };

  const baseActor = {
    id: 'user-elena-owner',
    email: 'elena.rostova@stellarimpact.org',
  };

  /* -------------------------------------------------------------------------- */
  /* Acceptance Criterion 1: Invitations Expire                                */
  /* -------------------------------------------------------------------------- */
  describe('1. Invitations Expiration', () => {
    it('accurately identifies active vs expired invitations against current time', () => {
      const now = new Date('2026-09-27T12:00:00.000Z');

      const futureInvite: SponsorInvitation = {
        ...mockInvitations[0],
        expiresAt: '2026-09-30T00:00:00.000Z',
        status: 'pending',
      };
      expect(isInvitationExpired(futureInvite, now)).toBe(false);

      const expiredInvite: SponsorInvitation = {
        ...mockInvitations[0],
        expiresAt: '2026-09-25T00:00:00.000Z',
        status: 'pending',
      };
      expect(isInvitationExpired(expiredInvite, now)).toBe(true);
    });

    it('denies acceptance when an invitation is expired', () => {
      const now = new Date('2026-09-27T12:00:00.000Z');
      const expiredInvite: SponsorInvitation = {
        ...mockInvitations[0],
        expiresAt: '2026-09-20T00:00:00.000Z',
        status: 'pending',
      };

      const result = canAcceptInvitation(expiredInvite, expiredInvite.email, now);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('EXPIRED');
    });

    it('allows resending an expired invitation with a fresh expiration window and token', () => {
      const now = new Date('2026-09-27T12:00:00.000Z');
      const expiredInvite: SponsorInvitation = {
        ...mockInvitations[2], // Sam Taylor (expired)
      };

      const { updatedInvitation, auditEvent } = resendSponsorInvitation(
        expiredInvite,
        baseActor,
        7,
        now
      );

      expect(updatedInvitation.status).toBe('pending');
      expect(updatedInvitation.token).not.toBe(expiredInvite.token);
      expect(isInvitationExpired(updatedInvitation, now)).toBe(false);
      expect(auditEvent.action).toBe('team.invitation_resent');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Acceptance Criterion 2: Acceptance is Single-Use                           */
  /* -------------------------------------------------------------------------- */
  describe('2. Single-Use Acceptance and Replay Protection', () => {
    it('allows accepting a valid, unconsumed invitation and records consumedAt', () => {
      const now = new Date('2026-09-27T12:00:00.000Z');
      const pendingInvite: SponsorInvitation = {
        ...mockInvitations[0], // Jordan Lee
        status: 'pending',
        consumedAt: undefined,
      };

      const { updatedInvitation, newMember, auditEvent } = acceptSponsorInvitation(
        pendingInvite,
        {
          id: 'user-jordan-new',
          email: pendingInvite.email,
          name: 'Jordan Lee',
        },
        now
      );

      expect(updatedInvitation.status).toBe('accepted');
      expect(updatedInvitation.consumedAt).toBe(now.toISOString());
      expect(newMember.status).toBe('active');
      expect(newMember.role).toBe(pendingInvite.role);
      expect(auditEvent.action).toBe('team.invitation_accepted');
    });

    it('rejects replay attempts on an already consumed invitation', () => {
      const now = new Date('2026-09-27T12:00:00.000Z');
      const consumedInvite: SponsorInvitation = {
        ...mockInvitations[3], // Priya Sharma (accepted/consumed)
        status: 'accepted',
        consumedAt: '2026-02-01T12:00:00.000Z',
      };

      const result = canAcceptInvitation(consumedInvite, consumedInvite.email, now);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('ALREADY_CONSUMED');

      expect(() =>
        acceptSponsorInvitation(
          consumedInvite,
          { id: 'user-hacker', email: consumedInvite.email, name: 'Replay Attacker' },
          now
        )
      ).toThrowError(/ALREADY_CONSUMED/);
    });

    it('rejects acceptance if the recipient email does not match the invitation', () => {
      const now = new Date('2026-09-27T12:00:00.000Z');
      const invite = mockInvitations[0]; // For jordan.lee@finpartners.com

      const result = canAcceptInvitation(invite, 'unauthorized.user@domain.com', now);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('RECIPIENT_MISMATCH');
    });

    it('rejects acceptance if the invitation was revoked by the sponsor owner', () => {
      const now = new Date('2026-09-27T12:00:00.000Z');
      const revokedInvite = mockInvitations[4]; // Malicious actor (revoked)

      const result = canAcceptInvitation(revokedInvite, revokedInvite.email, now);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('REVOKED');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Acceptance Criterion 3: Role Changes are Audited                           */
  /* -------------------------------------------------------------------------- */
  describe('3. Audited Role Changes', () => {
    it('produces an audit event recording previous and new role with actor details', () => {
      const now = new Date('2026-09-27T12:00:00.000Z');
      const member = mockTeamMembers[3]; // Dr. Alex Chen (reviewer)

      const { updatedMember, auditEvent } = updateSponsorMemberRole(
        member,
        'program',
        baseActor,
        'Elevated to program director for 2026 cohort',
        now
      );

      expect(updatedMember.role).toBe('program');
      expect(auditEvent.action).toBe('team.member_role_updated');
      expect(auditEvent.previousRole).toBe('reviewer');
      expect(auditEvent.newRole).toBe('program');
      expect(auditEvent.actorEmail).toBe(baseActor.email);
      expect(auditEvent.reason).toContain('Elevated to program director');
    });

    it('rejects modifying a member to their already assigned role', () => {
      const member = mockTeamMembers[1]; // Marcus Vance (finance)
      expect(() =>
        updateSponsorMemberRole(member, 'finance', baseActor, 'No-op change')
      ).toThrowError(/already holds the finance role/);
    });

    it('rejects role changes for members that have been removed', () => {
      const removedMember = mockTeamMembers[6]; // John Doe (status: 'removed')
      expect(() =>
        updateSponsorMemberRole(removedMember, 'reviewer', baseActor, 'Attempt on removed member')
      ).toThrowError(/Cannot update role for a removed team member/);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Acceptance Criterion 4: Removed Members Lose Access Immediately            */
  /* -------------------------------------------------------------------------- */
  describe('4. Immediate Access Revocation for Removed Members', () => {
    it('immediately denies any permission check for a member marked as removed', () => {
      const activeMember: SponsorTeamMember = {
        ...mockTeamMembers[1], // Marcus Vance (finance)
        status: 'active',
      };
      // Active finance member can read financial data
      expect(canPerformSponsorAction(activeMember, 'finance:read')).toEqual({ allowed: true });

      // Member is removed
      const { updatedMember: removedMember, auditEvent } = removeSponsorMember(
        activeMember,
        baseActor,
        'Contract terminated'
      );

      expect(removedMember.status).toBe('removed');
      expect(auditEvent.action).toBe('team.member_removed');

      // Access is denied immediately without grace period
      const checkFinance = canPerformSponsorAction(removedMember, 'finance:read');
      expect(checkFinance.allowed).toBe(false);
      expect(checkFinance.reason).toBe('MEMBERSHIP_REMOVED');

      const checkTeam = canPerformSponsorAction(removedMember, 'team:read');
      expect(checkTeam.allowed).toBe(false);
      expect(checkTeam.reason).toBe('MEMBERSHIP_REMOVED');
    });

    it('denies permissions when a member status is suspended', () => {
      const suspendedMember = mockTeamMembers[5]; // Sarah Connor (status: 'suspended')
      const result = canPerformSponsorAction(suspendedMember, 'review:submit');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('MEMBERSHIP_SUSPENDED');
    });

    it('denies permissions when member is undefined (not a member)', () => {
      const result = canPerformSponsorAction(undefined, 'team:read');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('NOT_A_MEMBER');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Least-Privilege Role Boundaries                                            */
  /* -------------------------------------------------------------------------- */
  describe('5. Least-Privilege Role Isolation Matrix', () => {
    const activeOwner = mockTeamMembers[0]; // Elena Rostova
    const activeFinance = mockTeamMembers[1]; // Marcus Vance
    const activeProgram = mockTeamMembers[2]; // Priya Sharma
    const activeReviewer = mockTeamMembers[3]; // Alex Chen
    const activeReporting = mockTeamMembers[4]; // Tariq Al-Mansoor

    it('Owner holds complete administrative permissions', () => {
      expect(canPerformSponsorAction(activeOwner, 'team:manage').allowed).toBe(true);
      expect(canPerformSponsorAction(activeOwner, 'finance:manage').allowed).toBe(true);
      expect(canPerformSponsorAction(activeOwner, 'program:manage').allowed).toBe(true);
      expect(canPerformSponsorAction(activeOwner, 'review:submit').allowed).toBe(true);
      expect(canPerformSponsorAction(activeOwner, 'reporting:view').allowed).toBe(true);
    });

    it('Finance role cannot score applications or create programs or manage team', () => {
      expect(canPerformSponsorAction(activeFinance, 'finance:manage').allowed).toBe(true);
      expect(canPerformSponsorAction(activeFinance, 'finance:read').allowed).toBe(true);

      expect(canPerformSponsorAction(activeFinance, 'review:submit').allowed).toBe(false);
      expect(canPerformSponsorAction(activeFinance, 'program:manage').allowed).toBe(false);
      expect(canPerformSponsorAction(activeFinance, 'team:manage').allowed).toBe(false);
    });

    it('Program role cannot execute disbursements or manage team', () => {
      expect(canPerformSponsorAction(activeProgram, 'program:manage').allowed).toBe(true);
      expect(canPerformSponsorAction(activeProgram, 'program:read').allowed).toBe(true);

      expect(canPerformSponsorAction(activeProgram, 'finance:manage').allowed).toBe(false);
      expect(canPerformSponsorAction(activeProgram, 'team:manage').allowed).toBe(false);
    });

    it('Reviewer role can only score and view reviews, strictly isolated from finance & reporting', () => {
      expect(canPerformSponsorAction(activeReviewer, 'review:submit').allowed).toBe(true);
      expect(canPerformSponsorAction(activeReviewer, 'review:read').allowed).toBe(true);

      expect(canPerformSponsorAction(activeReviewer, 'finance:manage').allowed).toBe(false);
      expect(canPerformSponsorAction(activeReviewer, 'finance:read').allowed).toBe(false);
      expect(canPerformSponsorAction(activeReviewer, 'reporting:view').allowed).toBe(false);
      expect(canPerformSponsorAction(activeReviewer, 'team:manage').allowed).toBe(false);
    });

    it('Reporting role has read-only analytics, cannot mutate or review', () => {
      expect(canPerformSponsorAction(activeReporting, 'reporting:view').allowed).toBe(true);
      expect(canPerformSponsorAction(activeReporting, 'program:read').allowed).toBe(true);

      expect(canPerformSponsorAction(activeReporting, 'review:submit').allowed).toBe(false);
      expect(canPerformSponsorAction(activeReporting, 'finance:manage').allowed).toBe(false);
      expect(canPerformSponsorAction(activeReporting, 'program:manage').allowed).toBe(false);
      expect(canPerformSponsorAction(activeReporting, 'team:manage').allowed).toBe(false);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Validation & Filtering Helpers                                             */
  /* -------------------------------------------------------------------------- */
  describe('6. Invitation Payload Validation & Filtering', () => {
    it('validates email format and role specification', () => {
      expect(validateInvitePayload({ email: 'valid@sponsor.org', role: 'finance' }).valid).toBe(true);

      const invalidEmail = validateInvitePayload({ email: 'not-an-email', role: 'finance' });
      expect(invalidEmail.valid).toBe(false);
      expect(invalidEmail.errors.email).toBeDefined();

      const missingRole = validateInvitePayload({ email: 'user@sponsor.org', role: 'invalidRole' as any });
      expect(missingRole.valid).toBe(false);
      expect(missingRole.errors.role).toBeDefined();

      const invalidDays = validateInvitePayload({ email: 'user@sponsor.org', role: 'finance', expiresInDays: 120 });
      expect(invalidDays.valid).toBe(false);
      expect(invalidDays.errors.expiresInDays).toBeDefined();
    });

    it('filters members by role, status, and search string', () => {
      const financeMembers = filterMembers(mockTeamMembers, { role: 'finance' });
      expect(financeMembers.every((m) => m.role === 'finance')).toBe(true);

      const activeOnly = filterMembers(mockTeamMembers, { status: 'active' });
      expect(activeOnly.every((m) => m.status === 'active')).toBe(true);

      const searchResult = filterMembers(mockTeamMembers, { search: 'Elena' });
      expect(searchResult.length).toBe(1);
      expect(searchResult[0].name).toBe('Elena Rostova');
    });

    it('filters invitations by status and search string', () => {
      const pendingInvites = filterInvitations(mockInvitations, { status: 'pending' });
      expect(pendingInvites.every((i) => i.status === 'pending')).toBe(true);

      const searchEmail = filterInvitations(mockInvitations, { search: 'dara.okonkwo' });
      expect(searchEmail.length).toBe(1);
      expect(searchEmail[0].email).toBe('dara.okonkwo@africanacad.edu');
    });
  });
});
