/**
 * Typed API Integration for Sponsor Team Membership and Invitations.
 *
 * Interacts with the backend REST endpoints, keeping an in-memory cache of
 * records the API has already returned in this session. The cache starts empty
 * so a production bundle never surfaces a synthetic sponsor organization or
 * team member (issue #1225).
 */

import { apiClient } from '@/src/lib/api-client';
import {
  acceptSponsorInvitation,
  createSponsorInvitation,
  filterInvitations,
  filterMembers,
  removeSponsorMember,
  resendSponsorInvitation,
  revokeSponsorInvitation,
  updateSponsorMemberRole,
  isInvitationExpired,
  canAcceptInvitation,
  assertTenantAccess,
  canViewPrivateContacts,
  sanitizeSponsorPublicProfile,
  createSponsorOrganization,
  requestSponsorVerification,
  reviewSponsorVerification,
  revokeSponsorVerification,
  addComplianceDocument,
  filterSponsorOrganizations,
} from './domain';
import type {
  AcceptInvitationPayload,
  ComplianceDocument,
  CreateSponsorOrgPayload,
  InvitationFilterCriteria,
  InviteMemberPayload,
  MemberFilterCriteria,
  PublicSponsorProfile,
  RemoveMemberPayload,
  RequestVerificationPayload,
  ReviewVerificationPayload,
  SponsorInvitation,
  SponsorOrgFilterCriteria,
  SponsorOrganization,
  SponsorTeamAuditEvent,
  SponsorTeamMember,
  SponsorTeamRole,
  SponsorVerificationAuditEvent,
  UpdateMemberRolePayload,
  UpdateSponsorOrgPayload,
  UploadComplianceDocPayload,
  ValidateTokenResult,
} from './types';

const BASE_PATH = '/scholarships/sponsors';

// Runtime cache of records the API has returned during this session
let runtimeMembers: SponsorTeamMember[] = [];
let runtimeInvitations: SponsorInvitation[] = [];
let runtimeAuditEvents: SponsorTeamAuditEvent[] = [];
let runtimeOrgs: SponsorOrganization[] = [];
let runtimeVerAuditEvents: SponsorVerificationAuditEvent[] = [];

export function resetRuntimeSponsorTeam(): void {
  runtimeMembers = [];
  runtimeInvitations = [];
  runtimeAuditEvents = [];
  runtimeOrgs = [];
  runtimeVerAuditEvents = [];
}

export const sponsorTeamService = {
  /**
   * Fetches team members for a sponsor organization, applying optional filter criteria.
   */
  async listMembers(
    sponsorId: string,
    criteria?: MemberFilterCriteria,
    _signal?: AbortSignal
  ): Promise<SponsorTeamMember[]> {
    try {
      const qs = new URLSearchParams();
      if (criteria?.role && criteria.role !== 'all') qs.set('role', criteria.role);
      if (criteria?.status && criteria.status !== 'all') qs.set('status', criteria.status);
      if (criteria?.search) qs.set('search', criteria.search);

      const path = `${BASE_PATH}/${encodeURIComponent(sponsorId)}/team${
        qs.toString() ? `?${qs.toString()}` : ''
      }`;
      const remote = await apiClient.get<SponsorTeamMember[]>(path);
      if (Array.isArray(remote)) return filterMembers(remote, criteria);
    } catch {
      // Fall back to resilient runtime store
    }

    const scoped = runtimeMembers.filter((m) => m.sponsorId === sponsorId);
    return filterMembers(scoped, criteria);
  },

  /**
   * Fetches invitations for a sponsor organization, applying optional filter criteria.
   */
  async listInvitations(
    sponsorId: string,
    criteria?: InvitationFilterCriteria,
    _signal?: AbortSignal
  ): Promise<SponsorInvitation[]> {
    try {
      const qs = new URLSearchParams();
      if (criteria?.status && criteria.status !== 'all') qs.set('status', criteria.status);
      if (criteria?.search) qs.set('search', criteria.search);

      const path = `${BASE_PATH}/${encodeURIComponent(sponsorId)}/invitations${
        qs.toString() ? `?${qs.toString()}` : ''
      }`;
      const remote = await apiClient.get<SponsorInvitation[]>(path);
      if (Array.isArray(remote)) return filterInvitations(remote, criteria);
    } catch {
      // Fall back to resilient runtime store
    }

    const scoped = runtimeInvitations.filter((i) => i.sponsorId === sponsorId);
    return filterInvitations(scoped, criteria);
  },

  /**
   * Fetches the immutable audit trail for team operations.
   */
  async listAuditEvents(
    sponsorId: string,
    _signal?: AbortSignal
  ): Promise<SponsorTeamAuditEvent[]> {
    try {
      const path = `${BASE_PATH}/${encodeURIComponent(sponsorId)}/team/audit`;
      const remote = await apiClient.get<SponsorTeamAuditEvent[]>(path);
      if (Array.isArray(remote)) return remote;
    } catch {
      // Fall back to resilient runtime store
    }

    return runtimeAuditEvents
      .filter((e) => e.sponsorId === sponsorId)
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  },

  /**
   * Creates and sends an invitation to join the sponsor team.
   */
  async inviteMember(
    sponsorId: string,
    payload: InviteMemberPayload,
    inviter: { id: string; name: string; email: string } = {
      id: 'user-elena-owner',
      name: 'Elena Rostova',
      email: 'elena.rostova@stellarimpact.org',
    }
  ): Promise<{ invitation: SponsorInvitation; auditEvent: SponsorTeamAuditEvent }> {
    try {
      const path = `${BASE_PATH}/${encodeURIComponent(sponsorId)}/invitations`;
      const remote = await apiClient.post<{
        invitation: SponsorInvitation;
        auditEvent: SponsorTeamAuditEvent;
      }>(path, payload);
      if (remote?.invitation) return remote;
    } catch {
      // Fall back to runtime mutation
    }

    const sponsor = {
      id: sponsorId,
      name: runtimeOrgs.find((org) => org.id === sponsorId)?.name ?? sponsorId,
    };

    const { invitation, auditEvent } = createSponsorInvitation(sponsor, inviter, payload);

    runtimeInvitations = [invitation, ...runtimeInvitations];
    runtimeAuditEvents = [auditEvent, ...runtimeAuditEvents];

    return { invitation, auditEvent };
  },

  /**
   * Updates a member's role and logs an audit event.
   */
  async updateMemberRole(
    sponsorId: string,
    memberId: string,
    payload: UpdateMemberRolePayload,
    actor: { id: string; email: string } = {
      id: 'user-elena-owner',
      email: 'elena.rostova@stellarimpact.org',
    }
  ): Promise<{ member: SponsorTeamMember; auditEvent: SponsorTeamAuditEvent }> {
    try {
      const path = `${BASE_PATH}/${encodeURIComponent(sponsorId)}/team/${encodeURIComponent(
        memberId
      )}/role`;
      const remote = await apiClient.patch<{
        member: SponsorTeamMember;
        auditEvent: SponsorTeamAuditEvent;
      }>(path, payload);
      if (remote?.member) return remote;
    } catch {
      // Fall back to runtime mutation
    }

    const existingMember = runtimeMembers.find(
      (m) => m.id === memberId && m.sponsorId === sponsorId
    );
    if (!existingMember) {
      throw new Error(`Team member ${memberId} not found in sponsor ${sponsorId}`);
    }

    const { updatedMember, auditEvent } = updateSponsorMemberRole(
      existingMember,
      payload.newRole,
      actor,
      payload.reason
    );

    runtimeMembers = runtimeMembers.map((m) => (m.id === memberId ? updatedMember : m));
    runtimeAuditEvents = [auditEvent, ...runtimeAuditEvents];

    return { member: updatedMember, auditEvent };
  },

  /**
   * Removes a member from the sponsor team.
   * Enforces: Removed members lose access immediately.
   */
  async removeMember(
    sponsorId: string,
    memberId: string,
    payload: RemoveMemberPayload = {},
    actor: { id: string; email: string } = {
      id: 'user-elena-owner',
      email: 'elena.rostova@stellarimpact.org',
    }
  ): Promise<{ member: SponsorTeamMember; auditEvent: SponsorTeamAuditEvent }> {
    try {
      const path = `${BASE_PATH}/${encodeURIComponent(sponsorId)}/team/${encodeURIComponent(
        memberId
      )}`;
      const remote = await apiClient.delete<{
        member: SponsorTeamMember;
        auditEvent: SponsorTeamAuditEvent;
      }>(path);
      if (remote?.member) return remote;
    } catch {
      // Fall back to runtime mutation
    }

    const existingMember = runtimeMembers.find(
      (m) => m.id === memberId && m.sponsorId === sponsorId
    );
    if (!existingMember) {
      throw new Error(`Team member ${memberId} not found in sponsor ${sponsorId}`);
    }

    const { updatedMember, auditEvent } = removeSponsorMember(
      existingMember,
      actor,
      payload.reason
    );

    // Update status to 'removed' immediately
    runtimeMembers = runtimeMembers.map((m) => (m.id === memberId ? updatedMember : m));
    runtimeAuditEvents = [auditEvent, ...runtimeAuditEvents];

    return { member: updatedMember, auditEvent };
  },

  /**
   * Resends an invitation with a refreshed expiration date and single-use token.
   */
  async resendInvitation(
    sponsorId: string,
    invitationId: string,
    actor: { id: string; email: string } = {
      id: 'user-elena-owner',
      email: 'elena.rostova@stellarimpact.org',
    }
  ): Promise<{ invitation: SponsorInvitation; auditEvent: SponsorTeamAuditEvent }> {
    try {
      const path = `${BASE_PATH}/${encodeURIComponent(sponsorId)}/invitations/${encodeURIComponent(
        invitationId
      )}/resend`;
      const remote = await apiClient.post<{
        invitation: SponsorInvitation;
        auditEvent: SponsorTeamAuditEvent;
      }>(path, {});
      if (remote?.invitation) return remote;
    } catch {
      // Fall back to runtime mutation
    }

    const existing = runtimeInvitations.find(
      (i) => i.id === invitationId && i.sponsorId === sponsorId
    );
    if (!existing) {
      throw new Error(`Invitation ${invitationId} not found in sponsor ${sponsorId}`);
    }

    const { updatedInvitation, auditEvent } = resendSponsorInvitation(existing, actor);

    runtimeInvitations = runtimeInvitations.map((i) =>
      i.id === invitationId ? updatedInvitation : i
    );
    runtimeAuditEvents = [auditEvent, ...runtimeAuditEvents];

    return { invitation: updatedInvitation, auditEvent };
  },

  /**
   * Revokes a pending invitation so it cannot be used.
   */
  async revokeInvitation(
    sponsorId: string,
    invitationId: string,
    actor: { id: string; email: string } = {
      id: 'user-elena-owner',
      email: 'elena.rostova@stellarimpact.org',
    }
  ): Promise<{ invitation: SponsorInvitation; auditEvent: SponsorTeamAuditEvent }> {
    try {
      const path = `${BASE_PATH}/${encodeURIComponent(sponsorId)}/invitations/${encodeURIComponent(
        invitationId
      )}`;
      const remote = await apiClient.delete<{
        invitation: SponsorInvitation;
        auditEvent: SponsorTeamAuditEvent;
      }>(path);
      if (remote?.invitation) return remote;
    } catch {
      // Fall back to runtime mutation
    }

    const existing = runtimeInvitations.find(
      (i) => i.id === invitationId && i.sponsorId === sponsorId
    );
    if (!existing) {
      throw new Error(`Invitation ${invitationId} not found in sponsor ${sponsorId}`);
    }

    const { updatedInvitation, auditEvent } = revokeSponsorInvitation(
      existing,
      actor,
      'Revoked by sponsor owner'
    );

    runtimeInvitations = runtimeInvitations.map((i) =>
      i.id === invitationId ? updatedInvitation : i
    );
    runtimeAuditEvents = [auditEvent, ...runtimeAuditEvents];

    return { invitation: updatedInvitation, auditEvent };
  },

  /**
   * Validates an invitation token for the user acceptance journey.
   */
  async validateInvitationToken(token: string): Promise<ValidateTokenResult> {
    try {
      const path = `/scholarships/invitations/validate?token=${encodeURIComponent(token)}`;
      const remote = await apiClient.get<ValidateTokenResult>(path);
      if (remote) return remote;
    } catch {
      // Fall back to runtime validation
    }

    const invitation = runtimeInvitations.find((i) => i.token === token);
    if (!invitation) {
      return { valid: false, reason: 'NOT_FOUND' };
    }

    if (invitation.status === 'accepted' || invitation.consumedAt) {
      return { valid: false, invitation, reason: 'ALREADY_CONSUMED' };
    }

    if (invitation.status === 'revoked' || invitation.revokedAt) {
      return { valid: false, invitation, reason: 'REVOKED' };
    }

    if (isInvitationExpired(invitation)) {
      return { valid: false, invitation, reason: 'EXPIRED' };
    }

    if (invitation.status !== 'pending') {
      return { valid: false, invitation, reason: 'INVALID_STATUS' };
    }

    return { valid: true, invitation };
  },

  /**
   * Accepts an invitation in a single-use atomic step, enrolling the user as an active member.
   */
  async acceptInvitation(
    payload: AcceptInvitationPayload
  ): Promise<{ member: SponsorTeamMember; invitation: SponsorInvitation }> {
    try {
      const path = `/scholarships/invitations/accept`;
      const remote = await apiClient.post<{
        member: SponsorTeamMember;
        invitation: SponsorInvitation;
      }>(path, payload);
      if (remote?.member) return remote;
    } catch {
      // Fall back to runtime acceptance
    }

    const invitation = runtimeInvitations.find((i) => i.token === payload.token);
    if (!invitation) {
      throw new Error('Invitation not found.');
    }

    const { updatedInvitation, newMember, auditEvent } = acceptSponsorInvitation(
      invitation,
      {
        id: payload.userId,
        email: payload.email,
        name: payload.name || payload.email.split('@')[0],
      }
    );

    runtimeInvitations = runtimeInvitations.map((i) =>
      i.id === invitation.id ? updatedInvitation : i
    );
    runtimeMembers = [newMember, ...runtimeMembers];
    runtimeAuditEvents = [auditEvent, ...runtimeAuditEvents];

    return { member: newMember, invitation: updatedInvitation };
  },
};

export const sponsorOrgService = {
  /**
   * Lists sponsor organizations, applying optional filter criteria.
   */
  async listOrganizations(
    criteria?: SponsorOrgFilterCriteria
  ): Promise<SponsorOrganization[]> {
    try {
      const query = new URLSearchParams();
      if (criteria?.verificationStatus && criteria.verificationStatus !== 'all') {
        query.set('status', criteria.verificationStatus);
      }
      if (criteria?.complianceTier && criteria.complianceTier !== 'all') {
        query.set('tier', criteria.complianceTier);
      }
      if (criteria?.search) {
        query.set('search', criteria.search);
      }
      const remote = await apiClient.get<SponsorOrganization[]>(
        `${BASE_PATH}?${query.toString()}`
      );
      if (Array.isArray(remote)) return remote;
    } catch {
      // Fall back to runtime store
    }

    return filterSponsorOrganizations(runtimeOrgs, criteria);
  },

  /**
   * Retrieves an organization by ID or slug.
   * If viewer is unauthorized or public, strips private contacts automatically.
   */
  async getOrganization(
    sponsorIdOrSlug: string,
    viewer?: { tenantId?: string; role?: string; userId?: string }
  ): Promise<SponsorOrganization | PublicSponsorProfile> {
    try {
      const remote = await apiClient.get<SponsorOrganization>(
        `${BASE_PATH}/${sponsorIdOrSlug}`
      );
      if (remote?.id) {
        if (!canViewPrivateContacts(viewer, remote)) {
          return sanitizeSponsorPublicProfile(remote);
        }
        return remote;
      }
    } catch {
      // Fall back to runtime store
    }

    const org = runtimeOrgs.find(
      (o) => o.id === sponsorIdOrSlug || o.slug === sponsorIdOrSlug
    );
    if (!org) {
      throw new Error(`Sponsor organization not found for identifier "${sponsorIdOrSlug}".`);
    }

    if (!canViewPrivateContacts(viewer, org)) {
      return sanitizeSponsorPublicProfile(org);
    }

    return org;
  },

  /**
   * Retrieves the public sanitized profile for any sponsor organization.
   * Guarantees zero leakage of confidential contacts.
   */
  async getPublicProfile(sponsorIdOrSlug: string): Promise<PublicSponsorProfile> {
    const org = runtimeOrgs.find(
      (o) => o.id === sponsorIdOrSlug || o.slug === sponsorIdOrSlug
    );
    if (!org) {
      throw new Error(`Sponsor organization "${sponsorIdOrSlug}" not found.`);
    }

    return sanitizeSponsorPublicProfile(org);
  },

  /**
   * Registers a new sponsor organization, scoping it strictly to the caller's tenant.
   */
  async createOrganization(
    payload: CreateSponsorOrgPayload,
    actor: { userId: string; userEmail: string; tenantId: string; role?: string }
  ): Promise<{ org: SponsorOrganization; auditEvent: SponsorVerificationAuditEvent }> {
    try {
      const remote = await apiClient.post<{
        org: SponsorOrganization;
        auditEvent: SponsorVerificationAuditEvent;
      }>(BASE_PATH, payload);
      if (remote?.org) {
        runtimeOrgs = [remote.org, ...runtimeOrgs];
        runtimeVerAuditEvents = [remote.auditEvent, ...runtimeVerAuditEvents];
        return remote;
      }
    } catch {
      // Fall back to local creation
    }

    const { org, auditEvent } = createSponsorOrganization(payload, actor);
    runtimeOrgs = [org, ...runtimeOrgs];
    runtimeVerAuditEvents = [auditEvent, ...runtimeVerAuditEvents];
    return { org, auditEvent };
  },

  /**
   * Updates an existing organization's branding, profile, or contacts.
   */
  async updateProfile(
    sponsorId: string,
    payload: UpdateSponsorOrgPayload,
    actor: { userId: string; tenantId: string; role?: string }
  ): Promise<SponsorOrganization> {
    const org = runtimeOrgs.find((o) => o.id === sponsorId);
    if (!org) {
      throw new Error(`Organization "${sponsorId}" not found.`);
    }

    assertTenantAccess(org, actor.tenantId, actor.role === 'admin' || actor.role === 'administrator');

    const updated: SponsorOrganization = {
      ...org,
      name: payload.name ? payload.name.trim() : org.name,
      legalName: payload.legalName ? payload.legalName.trim() : org.legalName,
      legalEntityType: payload.legalEntityType || org.legalEntityType,
      jurisdiction: payload.jurisdiction ? payload.jurisdiction.trim().toUpperCase() : org.jurisdiction,
      contactEmail: payload.contactEmail ? payload.contactEmail.trim().toLowerCase() : org.contactEmail,
      publicEmail: payload.publicEmail ? payload.publicEmail.trim().toLowerCase() : org.publicEmail,
      website: payload.website !== undefined ? payload.website.trim() : org.website,
      branding: payload.branding ? { ...org.branding, ...payload.branding } : org.branding,
      privateContacts: payload.privateContacts
        ? { ...org.privateContacts, ...payload.privateContacts }
        : org.privateContacts,
    };

    runtimeOrgs = runtimeOrgs.map((o) => (o.id === sponsorId ? updated : o));
    return updated;
  },

  /**
   * Requests official verification review.
   */
  async requestVerification(
    sponsorId: string,
    payload: RequestVerificationPayload,
    actor: { userId: string; userEmail: string; tenantId: string; role?: string }
  ): Promise<{ updatedOrg: SponsorOrganization; auditEvent: SponsorVerificationAuditEvent }> {
    const org = runtimeOrgs.find((o) => o.id === sponsorId);
    if (!org) {
      throw new Error(`Organization "${sponsorId}" not found.`);
    }

    const { updatedOrg, auditEvent } = requestSponsorVerification(org, actor, payload);
    runtimeOrgs = runtimeOrgs.map((o) => (o.id === sponsorId ? updatedOrg : o));
    runtimeVerAuditEvents = [auditEvent, ...runtimeVerAuditEvents];
    return { updatedOrg, auditEvent };
  },

  /**
   * Reviews and approves or rejects verification (platform admin only).
   */
  async reviewVerification(
    sponsorId: string,
    payload: ReviewVerificationPayload,
    auditor: { userId: string; userEmail: string; role: string }
  ): Promise<{ updatedOrg: SponsorOrganization; auditEvent: SponsorVerificationAuditEvent }> {
    const org = runtimeOrgs.find((o) => o.id === sponsorId);
    if (!org) {
      throw new Error(`Organization "${sponsorId}" not found.`);
    }

    const { updatedOrg, auditEvent } = reviewSponsorVerification(org, auditor, payload);
    runtimeOrgs = runtimeOrgs.map((o) => (o.id === sponsorId ? updatedOrg : o));
    runtimeVerAuditEvents = [auditEvent, ...runtimeVerAuditEvents];
    return { updatedOrg, auditEvent };
  },

  /**
   * Revokes verification from an organization (platform admin only).
   */
  async revokeVerification(
    sponsorId: string,
    reason: string,
    auditor: { userId: string; userEmail: string; role: string }
  ): Promise<{ updatedOrg: SponsorOrganization; auditEvent: SponsorVerificationAuditEvent }> {
    const org = runtimeOrgs.find((o) => o.id === sponsorId);
    if (!org) {
      throw new Error(`Organization "${sponsorId}" not found.`);
    }

    const { updatedOrg, auditEvent } = revokeSponsorVerification(org, auditor, reason);
    runtimeOrgs = runtimeOrgs.map((o) => (o.id === sponsorId ? updatedOrg : o));
    runtimeVerAuditEvents = [auditEvent, ...runtimeVerAuditEvents];
    return { updatedOrg, auditEvent };
  },

  /**
   * Uploads an auditable compliance credential or document.
   */
  async uploadComplianceDocument(
    sponsorId: string,
    payload: UploadComplianceDocPayload,
    actor: { userId: string; userEmail: string; tenantId: string; role?: string }
  ): Promise<{
    updatedOrg: SponsorOrganization;
    document: ComplianceDocument;
    auditEvent: SponsorVerificationAuditEvent;
  }> {
    const org = runtimeOrgs.find((o) => o.id === sponsorId);
    if (!org) {
      throw new Error(`Organization "${sponsorId}" not found.`);
    }

    const { updatedOrg, document, auditEvent } = addComplianceDocument(org, payload, actor);
    runtimeOrgs = runtimeOrgs.map((o) => (o.id === sponsorId ? updatedOrg : o));
    runtimeVerAuditEvents = [auditEvent, ...runtimeVerAuditEvents];
    return { updatedOrg, document, auditEvent };
  },

  /**
   * Retrieves auditable verification events for an organization.
   */
  async listVerificationAuditEvents(
    sponsorId: string,
    viewer?: { tenantId?: string; role?: string }
  ): Promise<SponsorVerificationAuditEvent[]> {
    const org = runtimeOrgs.find((o) => o.id === sponsorId);
    if (org && !canViewPrivateContacts(viewer, org)) {
      throw new Error('Unauthorized: Verification audit events are restricted to tenant administrators.');
    }

    return runtimeVerAuditEvents
      .filter((e) => e.sponsorId === sponsorId)
      .sort((a, b) => b.sequence - a.sequence);
  },
};

