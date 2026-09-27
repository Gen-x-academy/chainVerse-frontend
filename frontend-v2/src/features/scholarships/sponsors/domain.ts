/**
 * Domain rules, validation, and state transformations for Sponsor Team Membership and Invitations.
 *
 * Implements core security invariants:
 * 1. Invitations expire after a defined duration (default 7 days).
 * 2. Acceptance is strictly single-use and atomic; replaying or reuse fails.
 * 3. Role changes are audited with previous and new roles, actor, and timestamp.
 * 4. Removed members immediately lose all permissions (canPerformSponsorAction returns allowed: false).
 * 5. Least-privilege role boundaries are strictly enforced.
 */

import {
  SPONSOR_ROLE_DEFINITIONS,
  type AcceptInvitationPayload,
  type ComplianceDocument,
  type ComplianceTier,
  type CreateSponsorOrgPayload,
  type InvitationFilterCriteria,
  type InviteMemberPayload,
  type MemberFilterCriteria,
  type PublicSponsorProfile,
  type RequestVerificationPayload,
  type ReviewVerificationPayload,
  type SponsorInvitation,
  type SponsorOrgFilterCriteria,
  type SponsorOrganization,
  type SponsorPermission,
  type SponsorTeamAuditEvent,
  type SponsorTeamMember,
  type SponsorTeamRole,
  type SponsorVerificationAction,
  type SponsorVerificationAuditEvent,
  type SponsorVerificationStatus,
  type UpdateSponsorOrgPayload,
  type UploadComplianceDocPayload,
  type ValidateTokenResult,
} from './types';

/**
 * Checks whether an invitation has expired based on current time.
 */
export function isInvitationExpired(invitation: SponsorInvitation, now: Date = new Date()): boolean {
  if (invitation.status === 'expired') return true;
  const expiryTime = Date.parse(invitation.expiresAt);
  if (Number.isNaN(expiryTime)) return true;
  return now.getTime() >= expiryTime;
}

/**
 * Validates if an invitation is eligible to be accepted by the given recipient.
 */
export function canAcceptInvitation(
  invitation: SponsorInvitation,
  recipientEmail: string,
  now: Date = new Date()
): {
  allowed: boolean;
  reason?: 'EXPIRED' | 'ALREADY_CONSUMED' | 'REVOKED' | 'RECIPIENT_MISMATCH' | 'INVALID_STATUS';
} {
  if (invitation.consumedAt || invitation.status === 'accepted') {
    return { allowed: false, reason: 'ALREADY_CONSUMED' };
  }

  if (invitation.revokedAt || invitation.status === 'revoked') {
    return { allowed: false, reason: 'REVOKED' };
  }

  if (isInvitationExpired(invitation, now)) {
    return { allowed: false, reason: 'EXPIRED' };
  }

  if (invitation.status !== 'pending') {
    return { allowed: false, reason: 'INVALID_STATUS' };
  }

  if (invitation.email.trim().toLowerCase() !== recipientEmail.trim().toLowerCase()) {
    return { allowed: false, reason: 'RECIPIENT_MISMATCH' };
  }

  return { allowed: true };
}

/**
 * Immediate Access Enforcement:
 * Evaluates whether a team member can perform an action.
 * If a member has been removed, access is immediately revoked without delay.
 */
export function canPerformSponsorAction(
  member: SponsorTeamMember | undefined,
  permission: SponsorPermission
): {
  allowed: boolean;
  reason?:
    | 'NOT_A_MEMBER'
    | 'MEMBERSHIP_REMOVED'
    | 'MEMBERSHIP_SUSPENDED'
    | 'INSUFFICIENT_ROLE_PERMISSIONS';
} {
  if (!member) {
    return { allowed: false, reason: 'NOT_A_MEMBER' };
  }

  // Acceptance criterion: Removed members lose access immediately
  if (member.status === 'removed') {
    return { allowed: false, reason: 'MEMBERSHIP_REMOVED' };
  }

  if (member.status === 'suspended') {
    return { allowed: false, reason: 'MEMBERSHIP_SUSPENDED' };
  }

  const roleDef = SPONSOR_ROLE_DEFINITIONS[member.role];
  if (!roleDef || !roleDef.permissions.includes(permission)) {
    return { allowed: false, reason: 'INSUFFICIENT_ROLE_PERMISSIONS' };
  }

  return { allowed: true };
}

/**
 * Validates an invite payload for well-formed email and acceptable role.
 */
export function validateInvitePayload(payload: InviteMemberPayload): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!payload.email || !payload.email.trim()) {
    errors.email = 'Email address is required.';
  } else if (!emailRegex.test(payload.email.trim())) {
    errors.email = 'Please provide a valid email address.';
  }

  const validRoles: SponsorTeamRole[] = ['owner', 'finance', 'program', 'reviewer', 'reporting'];
  if (!payload.role || !validRoles.includes(payload.role)) {
    errors.role = 'A valid team role must be selected.';
  }

  if (payload.expiresInDays !== undefined) {
    if (payload.expiresInDays <= 0 || payload.expiresInDays > 90) {
      errors.expiresInDays = 'Expiration duration must be between 1 and 90 days.';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Generates a pseudo-random single-use cryptographic token.
 */
export function generateInvitationToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = 'inv_';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Creates a new pending sponsor invitation.
 */
export function createSponsorInvitation(
  sponsor: { id: string; name: string },
  inviter: { id: string; name: string; email: string },
  payload: InviteMemberPayload,
  now: Date = new Date()
): { invitation: SponsorInvitation; auditEvent: SponsorTeamAuditEvent } {
  const validation = validateInvitePayload(payload);
  if (!validation.valid) {
    throw new Error(`Invalid invitation payload: ${Object.values(validation.errors).join(', ')}`);
  }

  const days = payload.expiresInDays && payload.expiresInDays > 0 ? payload.expiresInDays : 7;
  const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
  const invitationId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const token = generateInvitationToken();

  const invitation: SponsorInvitation = {
    id: invitationId,
    sponsorId: sponsor.id,
    sponsorName: sponsor.name,
    email: payload.email.trim().toLowerCase(),
    role: payload.role,
    invitedBy: inviter.id,
    invitedByName: inviter.name,
    invitedAt: now.toISOString(),
    expiresAt,
    status: 'pending',
    token,
    note: payload.note?.trim() || undefined,
  };

  const auditEvent: SponsorTeamAuditEvent = {
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sequence: 1,
    sponsorId: sponsor.id,
    actorId: inviter.id,
    actorEmail: inviter.email,
    action: 'team.invitation_created',
    targetId: invitationId,
    targetEmail: invitation.email,
    newRole: payload.role,
    occurredAt: now.toISOString(),
    reason: payload.note || `Invited as ${payload.role} by ${inviter.name}`,
  };

  return { invitation, auditEvent };
}

/**
 * Consumes an invitation in a single-use atomic step, producing a new team member and audit event.
 */
export function acceptSponsorInvitation(
  invitation: SponsorInvitation,
  user: { id: string; email: string; name: string },
  now: Date = new Date()
): {
  updatedInvitation: SponsorInvitation;
  newMember: SponsorTeamMember;
  auditEvent: SponsorTeamAuditEvent;
} {
  const acceptanceCheck = canAcceptInvitation(invitation, user.email, now);
  if (!acceptanceCheck.allowed) {
    throw new Error(`Invitation cannot be accepted: ${acceptanceCheck.reason}`);
  }

  const consumedAt = now.toISOString();

  const updatedInvitation: SponsorInvitation = {
    ...invitation,
    status: 'accepted',
    consumedAt,
  };

  const newMember: SponsorTeamMember = {
    id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sponsorId: invitation.sponsorId,
    userId: user.id,
    email: user.email.toLowerCase(),
    name: user.name,
    role: invitation.role,
    status: 'active',
    joinedAt: consumedAt,
    updatedAt: consumedAt,
    invitedBy: invitation.invitedBy,
    lastActiveAt: consumedAt,
  };

  const auditEvent: SponsorTeamAuditEvent = {
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sequence: 1,
    sponsorId: invitation.sponsorId,
    actorId: user.id,
    actorEmail: user.email,
    action: 'team.invitation_accepted',
    targetId: newMember.id,
    targetEmail: newMember.email,
    newRole: invitation.role,
    occurredAt: consumedAt,
    reason: `Invitation ${invitation.id} accepted by ${user.name}`,
  };

  return { updatedInvitation, newMember, auditEvent };
}

/**
 * Updates a member's role and emits an immutable audit event recording previous and new roles.
 */
export function updateSponsorMemberRole(
  member: SponsorTeamMember,
  newRole: SponsorTeamRole,
  actor: { id: string; email: string },
  reason?: string,
  now: Date = new Date()
): {
  updatedMember: SponsorTeamMember;
  auditEvent: SponsorTeamAuditEvent;
} {
  if (member.status === 'removed') {
    throw new Error('Cannot update role for a removed team member.');
  }

  if (member.role === newRole) {
    throw new Error(`Member already holds the ${newRole} role.`);
  }

  const previousRole = member.role;
  const updatedAt = now.toISOString();

  const updatedMember: SponsorTeamMember = {
    ...member,
    role: newRole,
    updatedAt,
  };

  const auditEvent: SponsorTeamAuditEvent = {
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sequence: 1,
    sponsorId: member.sponsorId,
    actorId: actor.id,
    actorEmail: actor.email,
    action: 'team.member_role_updated',
    targetId: member.id,
    targetEmail: member.email,
    previousRole,
    newRole,
    occurredAt: updatedAt,
    reason: reason || `Role updated from ${previousRole} to ${newRole}`,
  };

  return { updatedMember, auditEvent };
}

/**
 * Removes a member from the sponsor team, revoking all permissions immediately.
 */
export function removeSponsorMember(
  member: SponsorTeamMember,
  actor: { id: string; email: string },
  reason?: string,
  now: Date = new Date()
): {
  updatedMember: SponsorTeamMember;
  auditEvent: SponsorTeamAuditEvent;
} {
  const updatedAt = now.toISOString();

  const updatedMember: SponsorTeamMember = {
    ...member,
    status: 'removed',
    updatedAt,
  };

  const auditEvent: SponsorTeamAuditEvent = {
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sequence: 1,
    sponsorId: member.sponsorId,
    actorId: actor.id,
    actorEmail: actor.email,
    action: 'team.member_removed',
    targetId: member.id,
    targetEmail: member.email,
    previousRole: member.role,
    occurredAt: updatedAt,
    reason: reason || `Removed from team by ${actor.email}`,
  };

  return { updatedMember, auditEvent };
}

/**
 * Revokes a pending invitation before it is accepted.
 */
export function revokeSponsorInvitation(
  invitation: SponsorInvitation,
  actor: { id: string; email: string },
  reason?: string,
  now: Date = new Date()
): {
  updatedInvitation: SponsorInvitation;
  auditEvent: SponsorTeamAuditEvent;
} {
  if (invitation.status === 'accepted' || invitation.consumedAt) {
    throw new Error('Cannot revoke an already accepted invitation.');
  }

  const revokedAt = now.toISOString();

  const updatedInvitation: SponsorInvitation = {
    ...invitation,
    status: 'revoked',
    revokedAt,
  };

  const auditEvent: SponsorTeamAuditEvent = {
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sequence: 1,
    sponsorId: invitation.sponsorId,
    actorId: actor.id,
    actorEmail: actor.email,
    action: 'team.invitation_revoked',
    targetId: invitation.id,
    targetEmail: invitation.email,
    occurredAt: revokedAt,
    reason: reason || `Revoked by ${actor.email}`,
  };

  return { updatedInvitation, auditEvent };
}

/**
 * Resends an invitation with a fresh expiration date and token.
 */
export function resendSponsorInvitation(
  invitation: SponsorInvitation,
  actor: { id: string; email: string },
  expiresInDays: number = 7,
  now: Date = new Date()
): {
  updatedInvitation: SponsorInvitation;
  auditEvent: SponsorTeamAuditEvent;
} {
  if (invitation.status === 'accepted' || invitation.consumedAt) {
    throw new Error('Cannot resend an already accepted invitation.');
  }

  const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
  const token = generateInvitationToken();
  const resentAt = now.toISOString();

  const updatedInvitation: SponsorInvitation = {
    ...invitation,
    status: 'pending',
    token,
    invitedAt: resentAt,
    expiresAt,
    revokedAt: undefined,
  };

  const auditEvent: SponsorTeamAuditEvent = {
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sequence: 1,
    sponsorId: invitation.sponsorId,
    actorId: actor.id,
    actorEmail: actor.email,
    action: 'team.invitation_resent',
    targetId: invitation.id,
    targetEmail: invitation.email,
    newRole: invitation.role,
    occurredAt: resentAt,
    reason: `Resent invitation with expiration extended to ${expiresAt}`,
  };

  return { updatedInvitation, auditEvent };
}

/**
 * Filters a list of team members according to role, status, and search string.
 */
export function filterMembers(
  members: SponsorTeamMember[],
  criteria?: MemberFilterCriteria
): SponsorTeamMember[] {
  if (!criteria) return members;

  return members.filter((member) => {
    if (criteria.role && criteria.role !== 'all' && member.role !== criteria.role) {
      return false;
    }
    if (criteria.status && criteria.status !== 'all' && member.status !== criteria.status) {
      return false;
    }
    if (criteria.search && criteria.search.trim()) {
      const q = criteria.search.trim().toLowerCase();
      const matchName = member.name.toLowerCase().includes(q);
      const matchEmail = member.email.toLowerCase().includes(q);
      if (!matchName && !matchEmail) return false;
    }
    return true;
  });
}

/**
 * Filters a list of invitations according to status and search string.
 */
export function filterInvitations(
  invitations: SponsorInvitation[],
  criteria?: InvitationFilterCriteria
): SponsorInvitation[] {
  if (!criteria) return invitations;

  return invitations.filter((inv) => {
    if (criteria.status && criteria.status !== 'all' && inv.status !== criteria.status) {
      return false;
    }
    if (criteria.search && criteria.search.trim()) {
      const q = criteria.search.trim().toLowerCase();
      const matchEmail = inv.email.toLowerCase().includes(q);
      const matchRole = inv.role.toLowerCase().includes(q);
      if (!matchEmail && !matchRole) return false;
    }
    return true;
  });
}

/* ========================================================================== */
/* SPONSOR ORGANIZATIONS & VERIFIED PROFILES DOMAIN LOGIC                    */
/* ========================================================================== */

/**
 * Asserts that the actor has tenant-scoped access to the given sponsor organization.
 * System administrators bypass tenant isolation.
 */
export function assertTenantAccess(
  org: SponsorOrganization,
  actorTenantId?: string,
  isAdmin = false
): void {
  if (isAdmin) return;

  if (org.tenantId && (!actorTenantId || org.tenantId !== actorTenantId)) {
    throw new Error(
      `Cross-tenant access violation: Sponsor organization is scoped to tenant "${org.tenantId}".`
    );
  }
}

/**
 * Determines whether a given viewer is authorized to view confidential private contacts
 * (Billing, Legal, Compliance, Tax ID / Registration ID).
 * Only administrators or tenant owners/finance managers of the same tenant may view them.
 */
export function canViewPrivateContacts(
  viewer: { tenantId?: string; role?: string; userId?: string } | undefined,
  org: SponsorOrganization
): boolean {
  if (!viewer) return false;
  if (viewer.role === 'admin' || viewer.role === 'administrator') return true;

  if (
    viewer.tenantId &&
    org.tenantId &&
    viewer.tenantId === org.tenantId &&
    (viewer.role === 'owner' || viewer.role === 'finance')
  ) {
    return true;
  }

  return false;
}

/**
 * Sanitizes a full sponsor organization into a public profile.
 * CRITICAL PRIVACY INVARIANT:
 * Private contacts (billing, legal, compliance, taxId, registrationNumber)
 * are NEVER included in public-facing outputs.
 */
export function sanitizeSponsorPublicProfile(
  org: SponsorOrganization,
  programsCount = 0
): PublicSponsorProfile {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    legalEntityType: org.legalEntityType,
    jurisdiction: org.jurisdiction,
    verificationStatus: org.verificationStatus || 'unverified',
    complianceTier: org.complianceTier || 'tier1_standard',
    isVerified: Boolean(org.isVerified || org.verificationStatus === 'verified'),
    verifiedAt: org.verifiedAt,
    branding: org.branding || {},
    publicEmail: org.publicEmail || org.contactEmail,
    publicWebsite: org.publicWebsite || org.website,
    publicPhone: org.publicPhone,
    createdAt: org.createdAt,
    programsCount,
  };
}

/**
 * Validates the payload for registering a new sponsor organization.
 */
export function validateCreateSponsorOrgPayload(payload: CreateSponsorOrgPayload): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!payload.name || payload.name.trim().length < 2) {
    errors.push('Organization name must contain at least 2 characters.');
  }

  if (!payload.legalName || payload.legalName.trim().length < 2) {
    errors.push('Legal entity name is required.');
  }

  const validEntityTypes = ['corporation', 'foundation', 'dao', 'university', 'non_profit', 'individual'];
  if (!payload.legalEntityType || !validEntityTypes.includes(payload.legalEntityType)) {
    errors.push('A valid legal entity type must be specified.');
  }

  if (!payload.jurisdiction || payload.jurisdiction.trim().length < 2) {
    errors.push('Legal jurisdiction (e.g. ISO country code) is required.');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!payload.contactEmail || !emailRegex.test(payload.contactEmail)) {
    errors.push('A valid primary contact email is required.');
  }

  if (payload.publicEmail && !emailRegex.test(payload.publicEmail)) {
    errors.push('Public contact email is formatted incorrectly.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Creates a new sponsor organization, scoping it strictly to the creator's tenant.
 */
export function createSponsorOrganization(
  payload: CreateSponsorOrgPayload,
  actor: { userId: string; userEmail: string; tenantId: string; role?: string },
  now: Date = new Date()
): {
  org: SponsorOrganization;
  auditEvent: SponsorVerificationAuditEvent;
} {
  const validation = validateCreateSponsorOrgPayload(payload);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
  }

  const slug =
    payload.slug?.trim() ||
    payload.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

  const id = `sponsor-${slug}-${Date.now().toString(36)}`;
  const timestamp = now.toISOString();

  const org: SponsorOrganization = {
    id,
    name: payload.name.trim(),
    slug,
    contactEmail: payload.contactEmail.trim().toLowerCase(),
    website: payload.website?.trim(),
    createdAt: timestamp,
    tenantId: actor.tenantId,
    ownerId: actor.userId,
    legalName: payload.legalName.trim(),
    legalEntityType: payload.legalEntityType,
    jurisdiction: payload.jurisdiction.trim().toUpperCase(),
    verificationStatus: 'unverified',
    complianceTier: 'tier1_standard',
    isVerified: false,
    branding: payload.branding || {},
    publicEmail: (payload.publicEmail || payload.contactEmail).trim().toLowerCase(),
    publicWebsite: payload.website?.trim(),
    privateContacts: payload.privateContacts,
    complianceDocuments: [],
  };

  const auditEvent: SponsorVerificationAuditEvent = {
    id: `audit-ver-${Date.now()}-1`,
    sequence: 1,
    sponsorId: id,
    tenantId: actor.tenantId,
    actorId: actor.userId,
    actorEmail: actor.userEmail,
    actorRole: actor.role || 'owner',
    action: 'profile.created',
    newStatus: 'unverified',
    occurredAt: timestamp,
    metadata: {
      name: org.name,
      legalEntityType: org.legalEntityType,
      jurisdiction: org.jurisdiction,
    },
  };

  return { org, auditEvent };
}

/**
 * Requests official sponsor verification for an unverified or rejected organization.
 */
export function requestSponsorVerification(
  org: SponsorOrganization,
  actor: { userId: string; userEmail: string; tenantId: string; role?: string },
  payload: RequestVerificationPayload = {},
  now: Date = new Date()
): {
  updatedOrg: SponsorOrganization;
  auditEvent: SponsorVerificationAuditEvent;
} {
  assertTenantAccess(org, actor.tenantId, actor.role === 'admin' || actor.role === 'administrator');

  if (org.verificationStatus === 'pending') {
    throw new Error('Sponsor organization verification is already pending review.');
  }
  if (org.verificationStatus === 'verified') {
    throw new Error('Sponsor organization is already verified.');
  }

  const timestamp = now.toISOString();
  const previousStatus = org.verificationStatus || 'unverified';

  const updatedOrg: SponsorOrganization = {
    ...org,
    verificationStatus: 'pending',
    verificationNotes: payload.notes,
  };

  const auditEvent: SponsorVerificationAuditEvent = {
    id: `audit-ver-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    sequence: Date.now(),
    sponsorId: org.id,
    tenantId: org.tenantId || actor.tenantId,
    actorId: actor.userId,
    actorEmail: actor.userEmail,
    actorRole: actor.role || 'owner',
    action: 'verification.requested',
    previousStatus,
    newStatus: 'pending',
    reason: payload.notes,
    occurredAt: timestamp,
    metadata: {
      requestedTier: payload.requestedTier,
    },
  };

  return { updatedOrg, auditEvent };
}

/**
 * Reviews and adjudicates a pending verification request.
 * Strictly requires platform administrator role.
 */
export function reviewSponsorVerification(
  org: SponsorOrganization,
  auditor: { userId: string; userEmail: string; role: string },
  payload: ReviewVerificationPayload,
  now: Date = new Date()
): {
  updatedOrg: SponsorOrganization;
  auditEvent: SponsorVerificationAuditEvent;
} {
  const isAdmin = auditor.role === 'admin' || auditor.role === 'administrator';
  if (!isAdmin) {
    throw new Error('Unauthorized: Verification review requires platform administrator privileges.');
  }

  const timestamp = now.toISOString();
  const previousStatus = org.verificationStatus || 'unverified';
  const previousTier = org.complianceTier || 'tier1_standard';
  const isApproved = payload.decision === 'approved';

  const newStatus: SponsorVerificationStatus = isApproved ? 'verified' : 'rejected';
  const newTier = isApproved ? payload.assignedTier || previousTier : previousTier;

  const updatedOrg: SponsorOrganization = {
    ...org,
    verificationStatus: newStatus,
    complianceTier: newTier,
    isVerified: isApproved,
    verifiedAt: isApproved ? timestamp : undefined,
    verifiedBy: isApproved ? auditor.userId : undefined,
    verificationNotes: payload.notes,
  };

  const auditEvent: SponsorVerificationAuditEvent = {
    id: `audit-ver-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    sequence: Date.now(),
    sponsorId: org.id,
    tenantId: org.tenantId || 'global',
    actorId: auditor.userId,
    actorEmail: auditor.userEmail,
    actorRole: auditor.role,
    action: isApproved ? 'verification.approved' : 'verification.rejected',
    previousStatus,
    newStatus,
    previousTier,
    newTier,
    reason: payload.notes,
    occurredAt: timestamp,
  };

  return { updatedOrg, auditEvent };
}

/**
 * Revokes verified status from a sponsor organization.
 */
export function revokeSponsorVerification(
  org: SponsorOrganization,
  auditor: { userId: string; userEmail: string; role: string },
  reason: string,
  now: Date = new Date()
): {
  updatedOrg: SponsorOrganization;
  auditEvent: SponsorVerificationAuditEvent;
} {
  const isAdmin = auditor.role === 'admin' || auditor.role === 'administrator';
  if (!isAdmin) {
    throw new Error('Unauthorized: Revoking verification requires administrator privileges.');
  }

  const timestamp = now.toISOString();
  const previousStatus = org.verificationStatus || 'verified';

  const updatedOrg: SponsorOrganization = {
    ...org,
    verificationStatus: 'revoked',
    isVerified: false,
    verificationNotes: reason,
  };

  const auditEvent: SponsorVerificationAuditEvent = {
    id: `audit-ver-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    sequence: Date.now(),
    sponsorId: org.id,
    tenantId: org.tenantId || 'global',
    actorId: auditor.userId,
    actorEmail: auditor.userEmail,
    actorRole: auditor.role,
    action: 'verification.revoked',
    previousStatus,
    newStatus: 'revoked',
    reason,
    occurredAt: timestamp,
  };

  return { updatedOrg, auditEvent };
}

/**
 * Adds an auditable compliance credential or document to a sponsor organization.
 */
export function addComplianceDocument(
  org: SponsorOrganization,
  docPayload: UploadComplianceDocPayload,
  actor: { userId: string; userEmail: string; tenantId: string; role?: string },
  now: Date = new Date()
): {
  updatedOrg: SponsorOrganization;
  document: ComplianceDocument;
  auditEvent: SponsorVerificationAuditEvent;
} {
  assertTenantAccess(org, actor.tenantId, actor.role === 'admin' || actor.role === 'administrator');

  const timestamp = now.toISOString();
  const docId = `doc-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const document: ComplianceDocument = {
    id: docId,
    sponsorId: org.id,
    type: docPayload.type,
    title: docPayload.title.trim(),
    fileName: docPayload.fileName,
    fileSizeBytes: docPayload.fileSizeBytes,
    mimeType: docPayload.mimeType,
    uploadedAt: timestamp,
    uploadedBy: actor.userId,
    status: 'pending_review',
  };

  const updatedDocs = [...(org.complianceDocuments || []), document];

  const updatedOrg: SponsorOrganization = {
    ...org,
    complianceDocuments: updatedDocs,
  };

  const auditEvent: SponsorVerificationAuditEvent = {
    id: `audit-ver-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    sequence: Date.now(),
    sponsorId: org.id,
    tenantId: org.tenantId || actor.tenantId,
    actorId: actor.userId,
    actorEmail: actor.userEmail,
    actorRole: actor.role || 'owner',
    action: 'verification.document_uploaded',
    documentId: docId,
    occurredAt: timestamp,
    metadata: {
      type: document.type,
      title: document.title,
    },
  };

  return { updatedOrg, document, auditEvent };
}

/**
 * Filters a list of sponsor organizations according to criteria.
 */
export function filterSponsorOrganizations(
  orgs: SponsorOrganization[],
  criteria?: SponsorOrgFilterCriteria
): SponsorOrganization[] {
  if (!criteria) return orgs;

  return orgs.filter((org) => {
    if (criteria.tenantId && org.tenantId && org.tenantId !== criteria.tenantId) {
      return false;
    }
    if (
      criteria.verificationStatus &&
      criteria.verificationStatus !== 'all' &&
      (org.verificationStatus || 'unverified') !== criteria.verificationStatus
    ) {
      return false;
    }
    if (
      criteria.complianceTier &&
      criteria.complianceTier !== 'all' &&
      (org.complianceTier || 'tier1_standard') !== criteria.complianceTier
    ) {
      return false;
    }
    if (
      criteria.jurisdiction &&
      criteria.jurisdiction !== 'all' &&
      org.jurisdiction !== criteria.jurisdiction
    ) {
      return false;
    }
    if (criteria.search && criteria.search.trim()) {
      const q = criteria.search.trim().toLowerCase();
      const matchName = org.name.toLowerCase().includes(q);
      const matchSlug = org.slug.toLowerCase().includes(q);
      const matchLegal = (org.legalName || '').toLowerCase().includes(q);
      if (!matchName && !matchSlug && !matchLegal) return false;
    }
    return true;
  });
}

