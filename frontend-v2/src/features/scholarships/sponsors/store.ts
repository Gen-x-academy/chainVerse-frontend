/**
 * Zustand State Store for Sponsor Team Membership and Invitations.
 */

import { create } from 'zustand';
import { sponsorTeamService } from './service';
import type {
  InviteMemberPayload,
  MemberFilterCriteria,
  SponsorInvitation,
  SponsorMemberStatus,
  SponsorTeamAuditEvent,
  SponsorTeamMember,
  SponsorTeamRole,
  UpdateMemberRolePayload,
} from './types';

export interface SponsorTeamState {
  members: SponsorTeamMember[];
  invitations: SponsorInvitation[];
  auditEvents: SponsorTeamAuditEvent[];
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  successMessage: string | null;
  activeTab: 'members' | 'invitations' | 'audit';
  roleFilter: SponsorTeamRole | 'all';
  statusFilter: SponsorMemberStatus | 'all';
  searchQuery: string;

  // Actions
  setActiveTab: (tab: 'members' | 'invitations' | 'audit') => void;
  setRoleFilter: (role: SponsorTeamRole | 'all') => void;
  setStatusFilter: (status: SponsorMemberStatus | 'all') => void;
  setSearchQuery: (query: string) => void;
  clearMessages: () => void;

  fetchTeamData: (sponsorId: string) => Promise<void>;
  inviteMember: (
    sponsorId: string,
    payload: InviteMemberPayload,
    inviter?: { id: string; name: string; email: string }
  ) => Promise<boolean>;
  updateMemberRole: (
    sponsorId: string,
    memberId: string,
    payload: UpdateMemberRolePayload,
    actor?: { id: string; email: string }
  ) => Promise<boolean>;
  removeMember: (
    sponsorId: string,
    memberId: string,
    reason?: string,
    actor?: { id: string; email: string }
  ) => Promise<boolean>;
  resendInvitation: (
    sponsorId: string,
    invitationId: string,
    actor?: { id: string; email: string }
  ) => Promise<boolean>;
  revokeInvitation: (
    sponsorId: string,
    invitationId: string,
    actor?: { id: string; email: string }
  ) => Promise<boolean>;
}

export const useSponsorTeamStore = create<SponsorTeamState>((set, get) => ({
  members: [],
  invitations: [],
  auditEvents: [],
  isLoading: false,
  isMutating: false,
  error: null,
  successMessage: null,
  activeTab: 'members',
  roleFilter: 'all',
  statusFilter: 'all',
  searchQuery: '',

  setActiveTab: (tab) => set({ activeTab: tab }),
  setRoleFilter: (role) => set({ roleFilter: role }),
  setStatusFilter: (status) => set({ statusFilter: status }),
  setSearchQuery: (search) => set({ searchQuery: search }),
  clearMessages: () => set({ error: null, successMessage: null }),

  fetchTeamData: async (sponsorId: string) => {
    set({ isLoading: true, error: null });
    try {
      const [members, invitations, auditEvents] = await Promise.all([
        sponsorTeamService.listMembers(sponsorId),
        sponsorTeamService.listInvitations(sponsorId),
        sponsorTeamService.listAuditEvents(sponsorId),
      ]);
      set({
        members,
        invitations,
        auditEvents,
        isLoading: false,
      });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load sponsor team data.',
      });
    }
  },

  inviteMember: async (sponsorId, payload, inviter) => {
    set({ isMutating: true, error: null });
    try {
      const { invitation, auditEvent } = await sponsorTeamService.inviteMember(
        sponsorId,
        payload,
        inviter
      );
      set((state) => ({
        isMutating: false,
        invitations: [invitation, ...state.invitations],
        auditEvents: [auditEvent, ...state.auditEvents],
        successMessage: `Invitation sent successfully to ${payload.email}.`,
      }));
      return true;
    } catch (err) {
      set({
        isMutating: false,
        error: err instanceof Error ? err.message : 'Failed to send invitation.',
      });
      return false;
    }
  },

  updateMemberRole: async (sponsorId, memberId, payload, actor) => {
    set({ isMutating: true, error: null });
    try {
      const { member, auditEvent } = await sponsorTeamService.updateMemberRole(
        sponsorId,
        memberId,
        payload,
        actor
      );
      set((state) => ({
        isMutating: false,
        members: state.members.map((m) => (m.id === memberId ? member : m)),
        auditEvents: [auditEvent, ...state.auditEvents],
        successMessage: `Role updated to ${payload.newRole} for ${member.name}.`,
      }));
      return true;
    } catch (err) {
      set({
        isMutating: false,
        error: err instanceof Error ? err.message : 'Failed to update member role.',
      });
      return false;
    }
  },

  removeMember: async (sponsorId, memberId, reason, actor) => {
    set({ isMutating: true, error: null });
    try {
      const { member, auditEvent } = await sponsorTeamService.removeMember(
        sponsorId,
        memberId,
        { reason },
        actor
      );
      set((state) => ({
        isMutating: false,
        members: state.members.map((m) => (m.id === memberId ? member : m)),
        auditEvents: [auditEvent, ...state.auditEvents],
        successMessage: `Removed ${member.name} from team. Access has been revoked immediately.`,
      }));
      return true;
    } catch (err) {
      set({
        isMutating: false,
        error: err instanceof Error ? err.message : 'Failed to remove member.',
      });
      return false;
    }
  },

  resendInvitation: async (sponsorId, invitationId, actor) => {
    set({ isMutating: true, error: null });
    try {
      const { invitation, auditEvent } = await sponsorTeamService.resendInvitation(
        sponsorId,
        invitationId,
        actor
      );
      set((state) => ({
        isMutating: false,
        invitations: state.invitations.map((i) => (i.id === invitationId ? invitation : i)),
        auditEvents: [auditEvent, ...state.auditEvents],
        successMessage: `Invitation resent to ${invitation.email}.`,
      }));
      return true;
    } catch (err) {
      set({
        isMutating: false,
        error: err instanceof Error ? err.message : 'Failed to resend invitation.',
      });
      return false;
    }
  },

  revokeInvitation: async (sponsorId, invitationId, actor) => {
    set({ isMutating: true, error: null });
    try {
      const { invitation, auditEvent } = await sponsorTeamService.revokeInvitation(
        sponsorId,
        invitationId,
        actor
      );
      set((state) => ({
        isMutating: false,
        invitations: state.invitations.map((i) => (i.id === invitationId ? invitation : i)),
        auditEvents: [auditEvent, ...state.auditEvents],
        successMessage: `Invitation to ${invitation.email} was revoked.`,
      }));
      return true;
    } catch (err) {
      set({
        isMutating: false,
        error: err instanceof Error ? err.message : 'Failed to revoke invitation.',
      });
      return false;
    }
  },
}));
