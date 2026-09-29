/**
 * Typed API Service for Duplicate Application Prevention & Administrative Merges.
 *
 * The API is the only source of applicant records (issue #1225). When the
 * backend is unavailable the local stores stay empty rather than falling back
 * to synthetic applicants, so a production bundle can never present fixture
 * data as a real duplicate cluster.
 */

import { apiClient } from '@/src/lib/api-client';
import {
  evaluateApplicantUniqueness,
  executeApplicationMerge,
  reconcileDraftsSafely,
} from './domain';
import type {
  ApplicationMergeAuditRecord,
  DraftReconciliationStrategy,
  DuplicateCluster,
  ExistingApplicationSummary,
  MergeApplicationsPayload,
  ProgramUniquenessRule,
  ReconciledDraftResult,
  UniquenessCheckResult,
} from './types';
import type { SupportingDocument } from '../documents';

/**
 * Most restrictive default used when no rule has been published for a program.
 * This is policy rather than data, so it is safe to ship: it can only ever
 * block an application, never grant one or expose an applicant.
 */
const DEFAULT_UNIQUENESS_RULE: ProgramUniquenessRule = {
  programId: '*',
  scope: 'one_per_program_lifetime',
  maxApplicationsPerApplicant: 1,
  allowDraftResumption: true,
  lockTimeoutSeconds: 60,
};

let runtimeApplications: ExistingApplicationSummary[] = [];
let runtimeClusters: DuplicateCluster[] = [];
let runtimeRules: ProgramUniquenessRule[] = [];
let runtimeMergeAudits: ApplicationMergeAuditRecord[] = [];

export function resetDuplicateStores(): void {
  runtimeApplications = [];
  runtimeClusters = [];
  runtimeRules = [];
  runtimeMergeAudits = [];
}

const BASE_PATH = '/scholarships/duplicates';

export const applicationDuplicateService = {
  /**
   * Caches the uniqueness rules published by the API. Only the API may define
   * them; the client never invents a per-program rule.
   */
  async loadUniquenessRules(): Promise<ProgramUniquenessRule[]> {
    try {
      const remote = await apiClient.get<ProgramUniquenessRule[]>(`${BASE_PATH}/rules`);
      if (Array.isArray(remote)) runtimeRules = remote;
    } catch {
      // Keep whatever is already cached.
    }
    return runtimeRules;
  },

  /**
   * Evaluates uniqueness before starting or submitting an application.
   */
  async checkUniqueness(
    studentId: string,
    programId: string,
    roundId: string
  ): Promise<UniquenessCheckResult> {
    try {
      const remote = await apiClient.post<UniquenessCheckResult>(`${BASE_PATH}/check-uniqueness`, {
        studentId,
        programId,
        roundId,
      });
      if (remote) return remote;
    } catch {
      // Local evaluation fallback
    }

    if (runtimeRules.length === 0) await this.loadUniquenessRules();

    const rule =
      runtimeRules.find((candidate) => candidate.programId === programId) ??
      DEFAULT_UNIQUENESS_RULE;

    return evaluateApplicantUniqueness(studentId, programId, roundId, runtimeApplications, rule);
  },

  /**
   * Retrieves detected duplicate clusters for administrator review.
   */
  async listDuplicateClusters(): Promise<DuplicateCluster[]> {
    try {
      const remote = await apiClient.get<DuplicateCluster[]>(`${BASE_PATH}/clusters`);
      if (Array.isArray(remote)) return remote;
    } catch {
      // Local fallback
    }
    return runtimeClusters;
  },

  /**
   * Retrieves a single duplicate cluster by ID.
   */
  async getCluster(clusterId: string): Promise<DuplicateCluster | null> {
    try {
      const remote = await apiClient.get<DuplicateCluster>(
        `${BASE_PATH}/clusters/${encodeURIComponent(clusterId)}`
      );
      if (remote) return remote;
    } catch {
      // Local fallback
    }
    return runtimeClusters.find((c) => c.clusterId === clusterId) ?? null;
  },

  /**
   * Executes a controlled administrative merge of duplicate applications with audit trail.
   */
  async mergeApplications(
    payload: MergeApplicationsPayload
  ): Promise<{
    primaryApplication: ExistingApplicationSummary;
    auditRecord: ApplicationMergeAuditRecord;
  }> {
    const result = executeApplicationMerge(payload, runtimeApplications);

    // Update runtime application records
    runtimeApplications = runtimeApplications.map((app) => {
      if (app.id === result.primaryApplication.id) {
        return result.primaryApplication;
      }
      const secondaryMatch = result.mergedSecondaryApplications.find((s) => s.id === app.id);
      if (secondaryMatch) {
        return secondaryMatch;
      }
      return app;
    });

    // Remove resolved cluster from queue
    if (payload.clusterId) {
      runtimeClusters = runtimeClusters.filter((c) => c.clusterId !== payload.clusterId);
    }

    runtimeMergeAudits.unshift(result.auditRecord);

    try {
      await apiClient.post(`${BASE_PATH}/merge`, {
        payload,
        audit: result.auditRecord,
      });
    } catch {
      // Local fallback
    }

    return {
      primaryApplication: result.primaryApplication,
      auditRecord: result.auditRecord,
    };
  },

  /**
   * Safely reconciles conflicting drafts.
   */
  async reconcileDrafts(
    clientVersionA: {
      statementSummary: string;
      requestedAmountCents?: number;
      documents: SupportingDocument[];
      updatedAt: string;
    },
    clientVersionB: {
      statementSummary: string;
      requestedAmountCents?: number;
      documents: SupportingDocument[];
      updatedAt: string;
    },
    strategy: DraftReconciliationStrategy = 'keep_latest'
  ): Promise<ReconciledDraftResult> {
    return reconcileDraftsSafely(clientVersionA, clientVersionB, strategy);
  },

  /**
   * Retrieves audit log for application merges.
   */
  async getMergeAuditHistory(): Promise<ApplicationMergeAuditRecord[]> {
    return runtimeMergeAudits;
  },
};
