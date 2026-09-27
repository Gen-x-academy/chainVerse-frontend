'use client';

/**
 * Zustand State Store for Sponsor Organizations and Verified Profiles.
 */

import { create } from 'zustand';
import { sponsorOrgService } from './service';
import type {
  ComplianceTier,
  CreateSponsorOrgPayload,
  PublicSponsorProfile,
  RequestVerificationPayload,
  ReviewVerificationPayload,
  SponsorOrgFilterCriteria,
  SponsorOrganization,
  SponsorVerificationAuditEvent,
  SponsorVerificationStatus,
  UpdateSponsorOrgPayload,
  UploadComplianceDocPayload,
} from './types';

export interface SponsorOrgState {
  organizations: SponsorOrganization[];
  activeOrg: SponsorOrganization | PublicSponsorProfile | null;
  verificationAuditEvents: SponsorVerificationAuditEvent[];
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  successMessage: string | null;

  // Filters
  filterVerification: SponsorVerificationStatus | 'all';
  filterTier: ComplianceTier | 'all';
  searchQuery: string;

  // Actions
  setFilterVerification: (status: SponsorVerificationStatus | 'all') => void;
  setFilterTier: (tier: ComplianceTier | 'all') => void;
  setSearchQuery: (query: string) => void;
  clearMessages: () => void;
  reset: () => void;

  fetchOrganizations: (criteria?: SponsorOrgFilterCriteria) => Promise<void>;
  loadOrganization: (
    sponsorIdOrSlug: string,
    viewer?: { tenantId?: string; role?: string; userId?: string }
  ) => Promise<void>;
  createOrganization: (
    payload: CreateSponsorOrgPayload,
    actor: { userId: string; userEmail: string; tenantId: string; role?: string }
  ) => Promise<SponsorOrganization | null>;
  updateProfile: (
    sponsorId: string,
    payload: UpdateSponsorOrgPayload,
    actor: { userId: string; tenantId: string; role?: string }
  ) => Promise<boolean>;
  requestVerification: (
    sponsorId: string,
    payload: RequestVerificationPayload,
    actor: { userId: string; userEmail: string; tenantId: string; role?: string }
  ) => Promise<boolean>;
  reviewVerification: (
    sponsorId: string,
    payload: ReviewVerificationPayload,
    auditor: { userId: string; userEmail: string; role: string }
  ) => Promise<boolean>;
  uploadComplianceDoc: (
    sponsorId: string,
    payload: UploadComplianceDocPayload,
    actor: { userId: string; userEmail: string; tenantId: string; role?: string }
  ) => Promise<boolean>;
  fetchVerificationAudit: (
    sponsorId: string,
    viewer?: { tenantId?: string; role?: string }
  ) => Promise<void>;
}

export const useSponsorOrgStore = create<SponsorOrgState>((set, get) => ({
  organizations: [],
  activeOrg: null,
  verificationAuditEvents: [],
  isLoading: false,
  isMutating: false,
  error: null,
  successMessage: null,
  filterVerification: 'all',
  filterTier: 'all',
  searchQuery: '',

  setFilterVerification: (status) => set({ filterVerification: status }),
  setFilterTier: (tier) => set({ filterTier: tier }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  clearMessages: () => set({ error: null, successMessage: null }),

  reset: () =>
    set({
      organizations: [],
      activeOrg: null,
      verificationAuditEvents: [],
      isLoading: false,
      isMutating: false,
      error: null,
      successMessage: null,
      filterVerification: 'all',
      filterTier: 'all',
      searchQuery: '',
    }),

  fetchOrganizations: async (criteria) => {
    set({ isLoading: true, error: null });
    try {
      const orgs = await sponsorOrgService.listOrganizations(criteria);
      set({ organizations: orgs, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch organizations.',
        isLoading: false,
      });
    }
  },

  loadOrganization: async (sponsorIdOrSlug, viewer) => {
    set({ isLoading: true, error: null });
    try {
      const org = await sponsorOrgService.getOrganization(sponsorIdOrSlug, viewer);
      set({ activeOrg: org, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load organization profile.',
        isLoading: false,
      });
    }
  },

  createOrganization: async (payload, actor) => {
    set({ isMutating: true, error: null, successMessage: null });
    try {
      const { org } = await sponsorOrgService.createOrganization(payload, actor);
      set((state) => ({
        organizations: [org, ...state.organizations],
        activeOrg: org,
        isMutating: false,
        successMessage: `Organization "${org.name}" registered successfully.`,
      }));
      return org;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to register sponsor organization.',
        isMutating: false,
      });
      return null;
    }
  },

  updateProfile: async (sponsorId, payload, actor) => {
    set({ isMutating: true, error: null, successMessage: null });
    try {
      const updated = await sponsorOrgService.updateProfile(sponsorId, payload, actor);
      set((state) => ({
        organizations: state.organizations.map((o) => (o.id === sponsorId ? updated : o)),
        activeOrg: updated,
        isMutating: false,
        successMessage: 'Organization profile updated successfully.',
      }));
      return true;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to update profile.',
        isMutating: false,
      });
      return false;
    }
  },

  requestVerification: async (sponsorId, payload, actor) => {
    set({ isMutating: true, error: null, successMessage: null });
    try {
      const { updatedOrg, auditEvent } = await sponsorOrgService.requestVerification(
        sponsorId,
        payload,
        actor
      );
      set((state) => ({
        organizations: state.organizations.map((o) => (o.id === sponsorId ? updatedOrg : o)),
        activeOrg: updatedOrg,
        verificationAuditEvents: [auditEvent, ...state.verificationAuditEvents],
        isMutating: false,
        successMessage: 'Verification request submitted for compliance review.',
      }));
      return true;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to request verification.',
        isMutating: false,
      });
      return false;
    }
  },

  reviewVerification: async (sponsorId, payload, auditor) => {
    set({ isMutating: true, error: null, successMessage: null });
    try {
      const { updatedOrg, auditEvent } = await sponsorOrgService.reviewVerification(
        sponsorId,
        payload,
        auditor
      );
      const decisionWord = payload.decision === 'approved' ? 'approved' : 'rejected';
      set((state) => ({
        organizations: state.organizations.map((o) => (o.id === sponsorId ? updatedOrg : o)),
        activeOrg: updatedOrg,
        verificationAuditEvents: [auditEvent, ...state.verificationAuditEvents],
        isMutating: false,
        successMessage: `Verification ${decisionWord} successfully.`,
      }));
      return true;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to review verification.',
        isMutating: false,
      });
      return false;
    }
  },

  uploadComplianceDoc: async (sponsorId, payload, actor) => {
    set({ isMutating: true, error: null, successMessage: null });
    try {
      const { updatedOrg, auditEvent } = await sponsorOrgService.uploadComplianceDocument(
        sponsorId,
        payload,
        actor
      );
      set((state) => ({
        organizations: state.organizations.map((o) => (o.id === sponsorId ? updatedOrg : o)),
        activeOrg: updatedOrg,
        verificationAuditEvents: [auditEvent, ...state.verificationAuditEvents],
        isMutating: false,
        successMessage: `Compliance document "${payload.title}" uploaded.`,
      }));
      return true;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to upload compliance document.',
        isMutating: false,
      });
      return false;
    }
  },

  fetchVerificationAudit: async (sponsorId, viewer) => {
    try {
      const events = await sponsorOrgService.listVerificationAuditEvents(sponsorId, viewer);
      set({ verificationAuditEvents: events });
    } catch (err) {
      // Non-blocking for unprivileged viewers
      set({ verificationAuditEvents: [] });
    }
  },
}));
