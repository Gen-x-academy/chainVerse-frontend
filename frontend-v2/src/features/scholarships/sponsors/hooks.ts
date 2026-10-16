'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sponsorOrgService, sponsorTeamService } from './service';
import { useScholarshipKeys } from '../lib/useScholarshipKeys';
import type {
  AcceptInvitationPayload,
  CreateSponsorOrgPayload,
  InvitationFilterCriteria,
  InviteMemberPayload,
  MemberFilterCriteria,
  RemoveMemberPayload,
  RequestVerificationPayload,
  ReviewVerificationPayload,
  SponsorOrgFilterCriteria,
  UpdateMemberRolePayload,
  UpdateSponsorOrgPayload,
  UploadComplianceDocPayload,
} from './types';

/**
 * A short, stable, non-reversible digest of an invitation token, used to
 * partition the cache without exposing the credential.
 *
 * This is a cache-partition key, not a security primitive: it only has to make
 * two different tokens land in two different entries. The previous code put the
 * raw token in the key, which parked a live bearer credential in the query
 * cache and in React Query DevTools — readable by anything with devtools open,
 * and sufficient on its own to accept the invitation as the invitee.
 */
function invitationTokenDigest(token: string): string {
  // Two independent 32-bit hashes (FNV-1a and djb2) concatenated to 64 bits.
  // Invitation tokens are high-entropy random strings, so this is not reversible
  // by brute force; the digest is a cache key and must never be treated as a
  // secret or logged.
  let fnv = 0x811c9dc5;
  let djb = 5381;
  for (let i = 0; i < token.length; i += 1) {
    const code = token.charCodeAt(i);
    fnv = Math.imul(fnv ^ code, 0x01000193) >>> 0;
    djb = (Math.imul(djb, 33) ^ code) >>> 0;
  }
  return `${fnv.toString(36)}-${djb.toString(36)}`;
}

/**
 * Sponsor-team keys hang off the identity-scoped scholarship root (#1227).
 */

export function useSponsorTeamMembers(sponsorId: string, criteria?: MemberFilterCriteria) {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.sponsorTeam.group('members').list({ ...criteria, sponsorId }),
    queryFn: ({ signal }) => sponsorTeamService.listMembers(sponsorId, criteria, signal),
    enabled: Boolean(sponsorId),
    staleTime: 30 * 1000,
  });
}

export function useSponsorInvitations(sponsorId: string, criteria?: InvitationFilterCriteria) {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.sponsorTeam.group('invitations').list({ ...criteria, sponsorId }),
    queryFn: ({ signal }) => sponsorTeamService.listInvitations(sponsorId, criteria, signal),
    enabled: Boolean(sponsorId),
    staleTime: 30 * 1000,
  });
}

export function useSponsorAuditEvents(sponsorId: string) {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.sponsorTeam.group('audit').detail(sponsorId),
    queryFn: ({ signal }) => sponsorTeamService.listAuditEvents(sponsorId, signal),
    enabled: Boolean(sponsorId),
    staleTime: 60 * 1000,
  });
}

export function useValidateInvitationToken(token: string) {
  const keys = useScholarshipKeys();
  return useQuery({
    // Partitioned by digest so a changed token always fetches its own verdict,
    // while the credential itself stays out of the cache.
    queryKey: keys.sponsorTeam.at('validate-invitation', invitationTokenDigest(token)),
    queryFn: () => sponsorTeamService.validateInvitationToken(token),
    enabled: Boolean(token),
    retry: false,
    // The verdict is single-use: a revoked invitation must stop looking valid.
    staleTime: 0,
    refetchOnMount: 'always',
    gcTime: 0,
  });
}

export function useInviteSponsorMember(sponsorId: string) {
  const queryClient = useQueryClient();
  const keys = useScholarshipKeys();
  return useMutation({
    mutationFn: (payload: InviteMemberPayload) =>
      sponsorTeamService.inviteMember(sponsorId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.sponsorTeam.group('invitations').lists() });
      queryClient.invalidateQueries({ queryKey: keys.sponsorTeam.group('audit').detail(sponsorId) });
    },
  });
}

export function useUpdateSponsorMemberRole(sponsorId: string) {
  const queryClient = useQueryClient();
  const keys = useScholarshipKeys();
  return useMutation({
    mutationFn: ({ memberId, payload }: { memberId: string; payload: UpdateMemberRolePayload }) =>
      sponsorTeamService.updateMemberRole(sponsorId, memberId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.sponsorTeam.group('members').lists() });
      queryClient.invalidateQueries({ queryKey: keys.sponsorTeam.group('audit').detail(sponsorId) });
    },
  });
}

export function useRemoveSponsorMember(sponsorId: string) {
  const queryClient = useQueryClient();
  const keys = useScholarshipKeys();
  return useMutation({
    mutationFn: ({ memberId, payload }: { memberId: string; payload?: RemoveMemberPayload }) =>
      sponsorTeamService.removeMember(sponsorId, memberId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.sponsorTeam.group('members').lists() });
      queryClient.invalidateQueries({ queryKey: keys.sponsorTeam.group('audit').detail(sponsorId) });
    },
  });
}

export function useResendSponsorInvitation(sponsorId: string) {
  const queryClient = useQueryClient();
  const keys = useScholarshipKeys();
  return useMutation({
    mutationFn: (invitationId: string) =>
      sponsorTeamService.resendInvitation(sponsorId, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.sponsorTeam.group('invitations').lists() });
      queryClient.invalidateQueries({ queryKey: keys.sponsorTeam.group('audit').detail(sponsorId) });
    },
  });
}

export function useRevokeSponsorInvitation(sponsorId: string) {
  const queryClient = useQueryClient();
  const keys = useScholarshipKeys();
  return useMutation({
    mutationFn: (invitationId: string) =>
      sponsorTeamService.revokeInvitation(sponsorId, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.sponsorTeam.group('invitations').lists() });
      queryClient.invalidateQueries({ queryKey: keys.sponsorTeam.group('audit').detail(sponsorId) });
    },
  });
}

export function useAcceptSponsorInvitation() {
  const queryClient = useQueryClient();
  const keys = useScholarshipKeys();
  return useMutation({
    mutationFn: (payload: AcceptInvitationPayload) =>
      sponsorTeamService.acceptInvitation(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.sponsorTeam.all });
    },
  });
}

/* ========================================================================== */
/* SPONSOR ORGANIZATIONS & VERIFIED PROFILES HOOKS                            */
/* ========================================================================== */



export function useSponsorOrganizations(criteria?: SponsorOrgFilterCriteria) {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.sponsorOrgs.list(criteria),
    queryFn: () => sponsorOrgService.listOrganizations(criteria),
    staleTime: 60 * 1000,
  });
}

export function useSponsorOrganization(
  sponsorIdOrSlug: string,
  viewer?: { tenantId?: string; role?: string; userId?: string }
) {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.sponsorOrgs.at('detail', sponsorIdOrSlug, viewer ?? {}),
    queryFn: () => sponsorOrgService.getOrganization(sponsorIdOrSlug, viewer),
    enabled: Boolean(sponsorIdOrSlug),
    staleTime: 30 * 1000,
  });
}

export function usePublicSponsorProfile(sponsorIdOrSlug: string) {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.sponsorOrgs.at('public', sponsorIdOrSlug),
    queryFn: () => sponsorOrgService.getPublicProfile(sponsorIdOrSlug),
    enabled: Boolean(sponsorIdOrSlug),
    staleTime: 60 * 1000,
  });
}

export function useSponsorVerificationAudit(
  sponsorId: string,
  viewer?: { tenantId?: string; role?: string }
) {
  const keys = useScholarshipKeys();
  return useQuery({
    queryKey: keys.sponsorOrgs.at('audit', sponsorId),
    queryFn: () => sponsorOrgService.listVerificationAuditEvents(sponsorId, viewer),
    enabled: Boolean(sponsorId),
    staleTime: 30 * 1000,
  });
}

export function useCreateSponsorOrganization() {
  const queryClient = useQueryClient();
  const keys = useScholarshipKeys();
  return useMutation({
    mutationFn: ({
      payload,
      actor,
    }: {
      payload: CreateSponsorOrgPayload;
      actor: { userId: string; userEmail: string; tenantId: string; role?: string };
    }) => sponsorOrgService.createOrganization(payload, actor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.sponsorOrgs.all });
    },
  });
}

export function useUpdateSponsorProfile(sponsorId: string) {
  const queryClient = useQueryClient();
  const keys = useScholarshipKeys();
  return useMutation({
    mutationFn: ({
      payload,
      actor,
    }: {
      payload: UpdateSponsorOrgPayload;
      actor: { userId: string; tenantId: string; role?: string };
    }) => sponsorOrgService.updateProfile(sponsorId, payload, actor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.sponsorOrgs.all });
    },
  });
}

export function useRequestSponsorVerification(sponsorId: string) {
  const queryClient = useQueryClient();
  const keys = useScholarshipKeys();
  return useMutation({
    mutationFn: ({
      payload,
      actor,
    }: {
      payload: RequestVerificationPayload;
      actor: { userId: string; userEmail: string; tenantId: string; role?: string };
    }) => sponsorOrgService.requestVerification(sponsorId, payload, actor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.sponsorOrgs.all });
    },
  });
}

export function useReviewSponsorVerification(sponsorId: string) {
  const queryClient = useQueryClient();
  const keys = useScholarshipKeys();
  return useMutation({
    mutationFn: ({
      payload,
      auditor,
    }: {
      payload: ReviewVerificationPayload;
      auditor: { userId: string; userEmail: string; role: string };
    }) => sponsorOrgService.reviewVerification(sponsorId, payload, auditor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.sponsorOrgs.all });
    },
  });
}

export function useUploadComplianceDocument(sponsorId: string) {
  const queryClient = useQueryClient();
  const keys = useScholarshipKeys();
  return useMutation({
    mutationFn: ({
      payload,
      actor,
    }: {
      payload: UploadComplianceDocPayload;
      actor: { userId: string; userEmail: string; tenantId: string; role?: string };
    }) => sponsorOrgService.uploadComplianceDocument(sponsorId, payload, actor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.sponsorOrgs.all });
    },
  });
}

