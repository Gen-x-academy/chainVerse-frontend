/**
 * Typed API Service for Application Opening and Deadline Windows.
 *
 * The backend is the only authority for windows, audits and deadline impact.
 * Nothing is cached in module scope, so a refresh or a second device observes
 * the same state, and a failed request surfaces as an error instead of quietly
 * falling back to fixtures (#1210).
 *
 * Deadline impact is previewed server-side, so the counts reflect real
 * submitted applications and no applicant identity is sent to the browser
 * (#1211).
 */

import { apiClient } from '@/src/lib/api-client';
import { evaluateSubmissionTiming, validateApplicationWindow } from './domain';
 * The API is the only source of window and submission records (issue #1225).
 * Local stores start empty so a production bundle never renders synthetic
 * application windows or synthetic applicant submissions.
 */

import { apiClient } from '@/src/lib/api-client';
import {
  buildApplicationWindow,
  evaluateDeadlineChange,
  evaluateSubmissionTiming,
  validateApplicationWindow,
} from './domain';
import type {
  ApplicationWindow,
  CreateWindowPayload,
  DeadlineChangeAssessment,
  DeadlineChangeAuditRecord,
  TimingEvaluationResult,
  UpdateWindowPayload,
  WindowQueryParams,
} from './types';

const BASE_PATH = '/scholarships/windows';

/** A preview older than this must be re-requested before it can be confirmed. */
export const PREVIEW_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * Raised when the backend refuses a mutation because the window changed after
 * it was read. The caller should reload rather than retry blindly.
 */
export class WindowConflictError extends Error {
  readonly code = 'WINDOW_VERSION_CONFLICT';

  constructor(readonly expectedVersion: number) {
    super(
      'This application window was changed by someone else. Reload to pick up the latest version before saving again.'
    );
    this.name = 'WindowConflictError';
  }
let runtimeWindows: ApplicationWindow[] = [];
let runtimeAudits: DeadlineChangeAuditRecord[] = [];
let runtimeSubmissions: SubmittedApplicationRecord[] = [];

export function resetWindowStores(): void {
  runtimeWindows = [];
  runtimeAudits = [];
  runtimeSubmissions = [];
}

/**
 * `apiClient` collapses every non-2xx into `Error(message)`, so the status is
 * only observable through the response body. The backend is expected to
 * include a `VERSION_CONFLICT` marker for stale writes.
 */
function isVersionConflict(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? '');
  return /VERSION_CONFLICT|version conflict|412|409/i.test(message);
}

function buildQuery(query?: WindowQueryParams): string {
  if (!query) return '';
  const params = new URLSearchParams();
  if (query.programId) params.set('programId', query.programId);
  if (query.roundId) params.set('roundId', query.roundId);
  if (query.search?.trim()) params.set('search', query.search.trim());
  const serialised = params.toString();
  return serialised ? `?${serialised}` : '';
}

/**
 * A backend-computed impact preview. The shape extends the existing
 * `DeadlineChangeAssessment` so current consumers keep working, and adds the
 * version the preview was computed against so a confirmation can be bound to
 * it.
 */
export type DeadlineChangePreview = DeadlineChangeAssessment & {
  /** Server window version this preview was computed against. */
  previewVersion: number;
  issuedAtUtc: string;
};

/**
 * A preview is stale when it was computed against a different window version,
 * or when it has aged out. Either way it must not be used to confirm a change.
 */
export function isPreviewStale(
  preview: DeadlineChangePreview,
  currentVersion: number,
  now: Date = new Date(),
  maxAgeMs: number = PREVIEW_MAX_AGE_MS
): boolean {
  if (preview.previewVersion !== currentVersion) return true;
  const issuedAt = Date.parse(preview.issuedAtUtc);
  if (Number.isNaN(issuedAt)) return true;
  return now.getTime() - issuedAt > maxAgeMs;
}

export const programWindowService = {
  /**
   * Retrieves application windows matching optional query criteria.
   *
   * Filtering happens server-side so the returned set always matches the query
   * that produced it.
   */
  async listWindows(
    query?: WindowQueryParams,
    signal?: AbortSignal
  ): Promise<ApplicationWindow[]> {
    const remote = await apiClient.get<ApplicationWindow[]>(
      `${BASE_PATH}${buildQuery(query)}`,
      { signal }
    );
    return Array.isArray(remote) ? remote : [];
    try {
      const remote = await apiClient.get<ApplicationWindow[]>(BASE_PATH, { signal });
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
    return apiClient.get<ApplicationWindow>(`${BASE_PATH}/${encodeURIComponent(id)}`, { signal });
  },

  /**
   * Creates a new application opening and deadline window.
   *
   * The payload is validated locally first so obvious mistakes fail fast, but
   * the server assigns identity, version and UTC boundaries.
   */
  async createWindow(payload: CreateWindowPayload): Promise<ApplicationWindow> {
    const validation = validateApplicationWindow(payload);
    if (!validation.valid) {
      const detail = validation.errors
        .map((issue) => `${issue.field}: ${issue.message}`)
        .join(' ');
      throw new Error(`Application window is not valid. ${detail}`);
    }

    return apiClient.post<ApplicationWindow>(BASE_PATH, payload);
  },

  /**
   * Updates an existing application window.
   *
   * The write is version-aware: `expectedVersion` is the version the editor
   * loaded, and the backend refuses the change if the window has moved on.
   * That preserves the grandfathering guarantee — a deadline change never
   * silently invalidates applications submitted under the previous schedule —
   * without this service having to re-derive the impact itself.
   */
  async updateWindow(
    id: string,
    updates: UpdateWindowPayload,
    options: { expectedVersion?: number; changeReason?: string } = {}
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
      await this.getSubmittedApplicationsForWindow(id)
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
      return await apiClient.put<ApplicationWindow>(`${BASE_PATH}/${encodeURIComponent(id)}`, {
        window: updates,
        expectedVersion: options.expectedVersion,
        changeReason: updates.changeReason ?? options.changeReason,
      });
    } catch (err) {
      if (isVersionConflict(err)) {
        throw new WindowConflictError(options.expectedVersion ?? 0);
      }
      throw err;
    }
  },

  /**
   * Requests a privacy-safe impact preview for a proposed close time.
   *
   * The server counts the affected applications; it never returns applicant
   * identity, so the browser cannot render a list of affected students. The
   * returned `previewVersion` binds a later confirmation to this exact preview.
   */
  async evaluateDeadlineChange(
    windowId: string,
    proposedCloseUtc: string
  ): Promise<DeadlineChangePreview> {
    return apiClient.post<DeadlineChangePreview>(
      `${BASE_PATH}/${encodeURIComponent(windowId)}/deadline-change-preview`,
      { proposedCloseUtc }
  ): Promise<DeadlineChangeAssessment> {
    const window = await this.getWindow(windowId);
    return evaluateDeadlineChange(
      window,
      proposedCloseUtc,
      await this.getSubmittedApplicationsForWindow(windowId)
    );
  },

  /**
   * Evaluates if a submission timestamp is accepted under the active window.
   *
   * This stays client-side: it is a pure function of the window the caller
   * already holds and needs no applicant data.
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
   *
   * Grandfathering assessments depend on the real submission ledger, so this
   * reads from the API and only falls back to records already observed in this
   * session — never to bundled sample data (issue #1225).
   */
  async getSubmittedApplicationsForWindow(windowId: string): Promise<SubmittedApplicationRecord[]> {
    try {
      const remote = await apiClient.get<SubmittedApplicationRecord[]>(
        `${BASE_PATH}/${encodeURIComponent(windowId)}/submissions`
      );
      if (Array.isArray(remote)) {
        runtimeSubmissions = remote;
        return remote;
      }
    } catch {
      // Fall back to the records already observed in this session.
    }
    return runtimeSubmissions;
  },

  /**
   * Retrieves audit log for deadline modifications.
   */
  async getAuditHistory(windowId: string): Promise<DeadlineChangeAuditRecord[]> {
    const remote = await apiClient.get<DeadlineChangeAuditRecord[]>(
      `${BASE_PATH}/${encodeURIComponent(windowId)}/audits`
    );
    return Array.isArray(remote) ? remote : [];
  },
};

/**
 * Test-only helper. Guarded so the fixture reset cannot be reached from a
 * production bundle, where it would repopulate windows that only ever existed
 * in fixtures (#1210).
 */
export function resetWindowStores(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('resetWindowStores is not available in production.');
  }
}
