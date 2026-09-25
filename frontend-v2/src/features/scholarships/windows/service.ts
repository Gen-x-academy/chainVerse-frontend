/**
 * Typed API Service for Application Opening and Deadline Windows.
 */

import { apiClient } from '@/src/lib/api-client';
import {
  buildApplicationWindow,
  evaluateDeadlineChange,
  evaluateSubmissionTiming,
  validateApplicationWindow,
} from './domain';
import { mockApplicationWindows, mockSubmittedApplications } from './fixtures';
import type {
  ApplicationWindow,
  CreateWindowPayload,
  DeadlineChangeAssessment,
  DeadlineChangeAuditRecord,
  SubmittedApplicationRecord,
  TimingEvaluationResult,
  UpdateWindowPayload,
  WindowQueryParams,
} from './types';

let runtimeWindows: ApplicationWindow[] = [...mockApplicationWindows];
let runtimeAudits: DeadlineChangeAuditRecord[] = [];

export function resetWindowStores(): void {
  runtimeWindows = [...mockApplicationWindows];
  runtimeAudits = [];
}

const BASE_PATH = '/scholarships/windows';

export const programWindowService = {
  /**
   * Retrieves application windows matching optional query criteria.
   */
  async listWindows(
    query?: WindowQueryParams,
    signal?: AbortSignal
  ): Promise<ApplicationWindow[]> {
    try {
      const remote = await apiClient.get<ApplicationWindow[]>(BASE_PATH);
      if (Array.isArray(remote)) return remote;
    } catch {
      // Fallback
    }

    return runtimeWindows.filter((win) => {
      if (query?.programId && win.programId !== query.programId) return false;
      if (query?.roundId && win.roundId !== query.roundId) return false;
      if (query?.search && query.search.trim()) {
        const term = query.search.toLowerCase().trim();
        const matchesName = win.name.toLowerCase().includes(term);
        const matchesDesc = (win.description ?? '').toLowerCase().includes(term);
        const matchesProg = (win.programName ?? '').toLowerCase().includes(term);
        if (!matchesName && !matchesDesc && !matchesProg) return false;
      }
      return true;
    });
  },

  /**
   * Retrieves a single application window by ID.
   */
  async getWindow(id: string, signal?: AbortSignal): Promise<ApplicationWindow> {
    try {
      const remote = await apiClient.get<ApplicationWindow>(`${BASE_PATH}/${encodeURIComponent(id)}`);
      if (remote) return remote;
    } catch {
      // Fallback
    }

    const found = runtimeWindows.find((w) => w.id === id);
    if (!found) {
      throw new Error(`Application window "${id}" not found.`);
    }
    return found;
  },

  /**
   * Creates a new application opening and deadline window with deterministic UTC boundary conversion.
   */
  async createWindow(payload: CreateWindowPayload): Promise<ApplicationWindow> {
    const newWindow = buildApplicationWindow(payload);

    try {
      const remote = await apiClient.post<ApplicationWindow>(BASE_PATH, newWindow);
      if (remote) {
        runtimeWindows.unshift(remote);
        return remote;
      }
    } catch {
      // Local fallback
    }

    runtimeWindows.unshift(newWindow);
    return newWindow;
  },

  /**
   * Updates an existing application window.
   * Enforces grandfathering guarantee: deadline changes do not silently invalidate submitted applications.
   */
  async updateWindow(
    id: string,
    updates: UpdateWindowPayload
  ): Promise<ApplicationWindow> {
    const existingIndex = runtimeWindows.findIndex((w) => w.id === id);
    if (existingIndex === -1) {
      throw new Error(`Window "${id}" not found.`);
    }

    const current = runtimeWindows[existingIndex];
    const mergedPayload: CreateWindowPayload = {
      programId: updates.programId ?? current.programId,
      programName: updates.programName ?? current.programName,
      roundId: updates.roundId ?? current.roundId,
      name: updates.name ?? current.name,
      description: updates.description ?? current.description,
      openDate: updates.openDate ?? current.openDate,
      openTime: updates.openTime ?? current.openTime,
      closeDate: updates.closeDate ?? current.closeDate,
      closeTime: updates.closeTime ?? current.closeTime,
      timeZone: updates.timeZone ?? current.timeZone,
      gracePeriodMinutes: updates.gracePeriodMinutes ?? current.gracePeriodMinutes,
      lateSubmissionPolicy: updates.lateSubmissionPolicy ?? current.lateSubmissionPolicy,
      latePenaltyPercent: updates.latePenaltyPercent ?? current.latePenaltyPercent,
      lateCutoffDate: updates.lateCutoffDate,
      lateCutoffTime: updates.lateCutoffTime,
    };

    const updatedWindow = buildApplicationWindow(
      mergedPayload,
      id,
      current.version + 1
    );

    // Record audit entry for deadline modification
    const assessment = evaluateDeadlineChange(
      current,
      updatedWindow.closeInstantUtc,
      mockSubmittedApplications
    );

    const auditRecord: DeadlineChangeAuditRecord = {
      id: `audit-${Date.now()}`,
      windowId: id,
      programId: updatedWindow.programId,
      changedBy: 'administrator',
      changedAtUtc: new Date().toISOString(),
      previousCloseUtc: current.closeInstantUtc,
      newCloseUtc: updatedWindow.closeInstantUtc,
      reason: updates.changeReason ?? 'Administrative schedule revision',
      grandfatheredApplicationCount: assessment.affectedApplicationsCount,
    };
    runtimeAudits.unshift(auditRecord);

    try {
      const remote = await apiClient.put<ApplicationWindow>(
        `${BASE_PATH}/${encodeURIComponent(id)}`,
        { window: updatedWindow, audit: auditRecord }
      );
      if (remote) {
        runtimeWindows[existingIndex] = remote;
        return remote;
      }
    } catch {
      // Local fallback
    }

    runtimeWindows[existingIndex] = updatedWindow;
    return updatedWindow;
  },

  /**
   * Assesses the impact of changing a window's deadline before applying the modification.
   */
  async evaluateDeadlineChange(
    windowId: string,
    proposedCloseUtc: string
  ): Promise<DeadlineChangeAssessment> {
    const window = await this.getWindow(windowId);
    return evaluateDeadlineChange(window, proposedCloseUtc, mockSubmittedApplications);
  },

  /**
   * Evaluates if a submission timestamp is accepted under the active window.
   */
  async evaluateSubmissionTiming(
    windowId: string,
    submissionInstant: Date = new Date(),
    waiverToken?: string
  ): Promise<TimingEvaluationResult> {
    const window = await this.getWindow(windowId);
    return evaluateSubmissionTiming(submissionInstant, window, waiverToken);
  },

  /**
   * Retrieves submitted applications under this program window.
   */
  async getSubmittedApplicationsForWindow(windowId: string): Promise<SubmittedApplicationRecord[]> {
    return mockSubmittedApplications;
  },

  /**
   * Retrieves audit log for deadline modifications.
   */
  async getAuditHistory(windowId: string): Promise<DeadlineChangeAuditRecord[]> {
    return runtimeAudits.filter((a) => a.windowId === windowId);
  },
};
