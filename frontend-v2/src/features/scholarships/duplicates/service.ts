/**
 * Typed API Service for Duplicate Application Prevention & Administrative Merges.
 */

import { apiClient } from '@/src/lib/api-client';
import {
  evaluateApplicantUniqueness,
  executeApplicationMerge,
  reconcileDraftsSafely,
} from './domain';
import {
  mockDuplicateClusters,
  mockExistingApplications,
  mockUniquenessRules,
} from './fixtures';
import type {
  ApplicationMergeAuditRecord,
  DraftReconciliationStrategy,
  DuplicateCluster,
  ExistingApplicationSummary,
  MergeApplicationsPayload,
  ReconciledDraftResult,
  UniquenessCheckResult,
} from './types';
import type { SupportingDocument } from '../documents';

let runtimeApplications = [...mockExistingApplications];
let runtimeClusters = [...mockDuplicateClusters];
let runtimeMergeAudits: ApplicationMergeAuditRecord[] = [];

export function resetDuplicateStores(): void {
  runtimeApplications = [...mockExistingApplications];
  runtimeClusters = [...mockDuplicateClusters];
  runtimeMergeAudits = [];
}

const BASE_PATH = '/scholarships/duplicates';

export const applicationDuplicateService = {
  /**
   * Evaluates uniqueness before starting or submitting an application.
   */
  async checkUniqueness(
    studentId: string,
    programId: string,
    roundId: string
  ): Promise<UniquenessCheckResult> {
    const rule =
      mockUniquenessRules.find((r) => r.programId === programId) ?? mockUniquenessRules[0];

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
