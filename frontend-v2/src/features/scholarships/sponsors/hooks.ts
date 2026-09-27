'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sponsorOrgService, sponsorTeamService } from './service';
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

export const sponsorTeamQueryKeys = {
  all: ['sponsor-team'] as const,
  members: (sponsorId: string, criteria?: MemberFilterCriteria) =>
    [...sponsorTeamQueryKeys.all, 'members', sponsorId, criteria ?? {}] as const,
  invitations: (sponsorId: string, criteria?: InvitationFilterCriteria) =>
    [...sponsorTeamQueryKeys.all, 'invitations', sponsorId, criteria ?? {}] as const,
  audit: (sponsorId: string) =>
    [...sponsorTeamQueryKeys.all, 'audit', sponsorId] as const,
  validateToken: (token: string) =>
    [...sponsorTeamQueryKeys.all, 'validate-token', token] as const,
};

export function useSponsorTeamMembers(sponsorId: string, criteria?: MemberFilterCriteria) {
  return useQuery({
    queryKey: sponsorTeamQueryKeys.members(sponsorId, criteria),
    queryFn: ({ signal }) => sponsorTeamService.listMembers(sponsorId, criteria, signal),
    enabled: Boolean(sponsorId),
    staleTime: 30 * 1000,
  });
}

export function useSponsorInvitations(sponsorId: string, criteria?: InvitationFilterCriteria) {
  return useQuery({
    queryKey: sponsorTeamQueryKeys.invitations(sponsorId, criteria),
    queryFn: ({ signal }) => sponsorTeamService.listInvitations(sponsorId, criteria, signal),
    enabled: Boolean(sponsorId),
    staleTime: 30 * 1000,
  });
}

export function useSponsorAuditEvents(sponsorId: string) {
  return useQuery({
    queryKey: sponsorTeamQueryKeys.audit(sponsorId),
    queryFn: ({ signal }) => sponsorTeamService.listAuditEvents(sponsorId, signal),
    enabled: Boolean(sponsorId),
    staleTime: 60 * 1000,
  });
}

export function useValidateInvitationToken(token: string) {
  return useQuery({
    queryKey: sponsorTeamQueryKeys.validateToken(token),
    queryFn: () => sponsorTeamService.validateInvitationToken(token),
    enabled: Boolean(token),
    retry: false,
  });
}

export function useInviteSponsorMember(sponsorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: InviteMemberPayload) =>
      sponsorTeamService.inviteMember(sponsorId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sponsorTeamQueryKeys.invitations(sponsorId) });
      queryClient.invalidateQueries({ queryKey: sponsorTeamQueryKeys.audit(sponsorId) });
    },
  });
}

export function useUpdateSponsorMemberRole(sponsorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, payload }: { memberId: string; payload: UpdateMemberRolePayload }) =>
      sponsorTeamService.updateMemberRole(sponsorId, memberId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sponsorTeamQueryKeys.members(sponsorId) });
      queryClient.invalidateQueries({ queryKey: sponsorTeamQueryKeys.audit(sponsorId) });
    },
  });
}

export function useRemoveSponsorMember(sponsorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, payload }: { memberId: string; payload?: RemoveMemberPayload }) =>
      sponsorTeamService.removeMember(sponsorId, memberId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sponsorTeamQueryKeys.members(sponsorId) });
      queryClient.invalidateQueries({ queryKey: sponsorTeamQueryKeys.audit(sponsorId) });
    },
  });
}

export function useResendSponsorInvitation(sponsorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) =>
      sponsorTeamService.resendInvitation(sponsorId, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sponsorTeamQueryKeys.invitations(sponsorId) });
      queryClient.invalidateQueries({ queryKey: sponsorTeamQueryKeys.audit(sponsorId) });
    },
  });
}

export function useRevokeSponsorInvitation(sponsorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) =>
      sponsorTeamService.revokeInvitation(sponsorId, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sponsorTeamQueryKeys.invitations(sponsorId) });
      queryClient.invalidateQueries({ queryKey: sponsorTeamQueryKeys.audit(sponsorId) });
    },
  });
}

export function useAcceptSponsorInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AcceptInvitationPayload) =>
      sponsorTeamService.acceptInvitation(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sponsorTeamQueryKeys.all });
    },
  });
}

/* ========================================================================== */
/* SPONSOR ORGANIZATIONS & VERIFIED PROFILES HOOKS                            */
/* ========================================================================== */

export const sponsorOrgQueryKeys = {
  all: ['sponsor-orgs'] as const,
  list: (criteria?: SponsorOrgFilterCriteria) =>
    [...sponsorOrgQueryKeys.all, 'list', criteria ?? {}] as const,
  detail: (idOrSlug: string, viewer?: { tenantId?: string; role?: string; userId?: string }) =>
    [...sponsorOrgQueryKeys.all, 'detail', idOrSlug, viewer ?? {}] as const,
  public: (idOrSlug: string) =>
    [...sponsorOrgQueryKeys.all, 'public', idOrSlug] as const,
  audit: (sponsorId: string) =>
    [...sponsorOrgQueryKeys.all, 'audit', sponsorId] as const,
};

export function useSponsorOrganizations(criteria?: SponsorOrgFilterCriteria) {
  return useQuery({
    queryKey: sponsorOrgQueryKeys.list(criteria),
    queryFn: () => sponsorOrgService.listOrganizations(criteria),
    staleTime: 60 * 1000,
  });
}

export function useSponsorOrganization(
  sponsorIdOrSlug: string,
  viewer?: { tenantId?: string; role?: string; userId?: string }
) {
  return useQuery({
    queryKey: sponsorOrgQueryKeys.detail(sponsorIdOrSlug, viewer),
    queryFn: () => sponsorOrgService.getOrganization(sponsorIdOrSlug, viewer),
    enabled: Boolean(sponsorIdOrSlug),
    staleTime: 30 * 1000,
  });
}

export function usePublicSponsorProfile(sponsorIdOrSlug: string) {
  return useQuery({
    queryKey: sponsorOrgQueryKeys.public(sponsorIdOrSlug),
    queryFn: () => sponsorOrgService.getPublicProfile(sponsorIdOrSlug),
    enabled: Boolean(sponsorIdOrSlug),
    staleTime: 60 * 1000,
  });
}

export function useSponsorVerificationAudit(
  sponsorId: string,
  viewer?: { tenantId?: string; role?: string }
) {
  return useQuery({
    queryKey: sponsorOrgQueryKeys.audit(sponsorId),
    queryFn: () => sponsorOrgService.listVerificationAuditEvents(sponsorId, viewer),
    enabled: Boolean(sponsorId),
    staleTime: 30 * 1000,
  });
}

export function useCreateSponsorOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      payload,
      actor,
    }: {
      payload: CreateSponsorOrgPayload;
      actor: { userId: string; userEmail: string; tenantId: string; role?: string };
    }) => sponsorOrgService.createOrganization(payload, actor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sponsorOrgQueryKeys.all });
    },
  });
}

export function useUpdateSponsorProfile(sponsorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      payload,
      actor,
    }: {
      payload: UpdateSponsorOrgPayload;
      actor: { userId: string; tenantId: string; role?: string };
    }) => sponsorOrgService.updateProfile(sponsorId, payload, actor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sponsorOrgQueryKeys.all });
    },
  });
}

export function useRequestSponsorVerification(sponsorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      payload,
      actor,
    }: {
      payload: RequestVerificationPayload;
      actor: { userId: string; userEmail: string; tenantId: string; role?: string };
    }) => sponsorOrgService.requestVerification(sponsorId, payload, actor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sponsorOrgQueryKeys.all });
    },
  });
}

export function useReviewSponsorVerification(sponsorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      payload,
      auditor,
    }: {
      payload: ReviewVerificationPayload;
      auditor: { userId: string; userEmail: string; role: string };
    }) => sponsorOrgService.reviewVerification(sponsorId, payload, auditor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sponsorOrgQueryKeys.all });
    },
  });
}

export function useUploadComplianceDocument(sponsorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      payload,
      actor,
    }: {
      payload: UploadComplianceDocPayload;
      actor: { userId: string; userEmail: string; tenantId: string; role?: string };
    }) => sponsorOrgService.uploadComplianceDocument(sponsorId, payload, actor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sponsorOrgQueryKeys.all });
    },
  });
}

