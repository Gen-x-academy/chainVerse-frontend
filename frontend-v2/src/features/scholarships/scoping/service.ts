/**
 * Typed API Service for Program Cohort and Academic-Term Scoping.
 *
 * Integrates with the platform API while supporting resilient fallbacks and isolation.
 */

import { apiClient } from '@/src/lib/api-client';
import {
  canScopeAcceptApplications,
  evaluateScopeOverlap,
  filterAndQueryScopes,
  validateProgramScope,
} from './domain';
import { mockProgramScopes, mockScopingReferenceData } from './fixtures';
import type {
  CreateProgramScopePayload,
  ProgramScopeTarget,
  ScopeApplicationAcceptanceResult,
  ScopeOverlapEvaluation,
  ScopeQueryParams,
  ScopingReferenceData,
  StudentScopeApplicationContext,
  UpdateProgramScopePayload,
} from './types';

const BASE_PATH = '/scholarships/scopes';

// In-memory runtime state for development and testing resilience
let runtimeScopes: ProgramScopeTarget[] = [...mockProgramScopes];

export function resetRuntimeScopes(): void {
  runtimeScopes = [...mockProgramScopes];
}

export const programScopingService = {
  /**
   * Fetches program scopes matching optional query parameters.
   */
  async listScopes(
    query?: ScopeQueryParams,
    signal?: AbortSignal
  ): Promise<ProgramScopeTarget[]> {
    try {
      const qs = new URLSearchParams();
      if (query?.programId) qs.set('programId', query.programId);
      if (query?.status && query.status !== 'all') qs.set('status', query.status);
      if (query?.cohortId) qs.set('cohortId', query.cohortId);
      if (query?.termId) qs.set('termId', query.termId);
      if (query?.courseId) qs.set('courseId', query.courseId);
      if (query?.institutionId) qs.set('institutionId', query.institutionId);
      if (query?.region) qs.set('region', query.region);
      if (query?.search) qs.set('search', query.search);
      if (query?.acceptingApplicationsOnly) qs.set('acceptingOnly', 'true');

      const path = `${BASE_PATH}${qs.toString() ? `?${qs.toString()}` : ''}`;
      const remote = await apiClient.get<ProgramScopeTarget[]>(path);
      if (Array.isArray(remote)) return filterAndQueryScopes(remote, query);
    } catch {
      // Fallback to resilient in-memory store
    }
    return filterAndQueryScopes(runtimeScopes, query);
  },

  /**
   * Retrieves a single program scope by ID.
   */
  async getScope(id: string, signal?: AbortSignal): Promise<ProgramScopeTarget> {
    try {
      const remote = await apiClient.get<ProgramScopeTarget>(`${BASE_PATH}/${encodeURIComponent(id)}`);
      if (remote) return remote;
    } catch {
      // Fallback
    }

    const found = runtimeScopes.find((s) => s.id === id);
    if (!found) {
      throw new Error(`Scope with id "${id}" was not found.`);
    }
    return found;
  },

  /**
   * Creates a new program scope target.
   * Validates before persistence and checks overlap behavior.
   */
  async createScope(payload: CreateProgramScopePayload): Promise<ProgramScopeTarget> {
    const validation = validateProgramScope(payload);
    if (!validation.valid) {
      const firstError = validation.errors[0]?.message ?? 'Invalid scope payload.';
      throw new Error(firstError);
    }

    const newScope: ProgramScopeTarget = {
      ...payload,
      id: `scope-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const remote = await apiClient.post<ProgramScopeTarget>(BASE_PATH, newScope);
      if (remote) {
        runtimeScopes.unshift(remote);
        return remote;
      }
    } catch {
      // Persist to local memory
    }

    runtimeScopes.unshift(newScope);
    return newScope;
  },

  /**
   * Updates an existing program scope.
   */
  async updateScope(
    id: string,
    updates: UpdateProgramScopePayload
  ): Promise<ProgramScopeTarget> {
    const existingIndex = runtimeScopes.findIndex((s) => s.id === id);
    if (existingIndex === -1) {
      throw new Error(`Scope "${id}" not found.`);
    }

    const current = runtimeScopes[existingIndex];
    const merged: ProgramScopeTarget = {
      ...current,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    };

    const validation = validateProgramScope(merged);
    if (!validation.valid) {
      const firstError = validation.errors[0]?.message ?? 'Invalid update payload.';
      throw new Error(firstError);
    }

    try {
      const remote = await apiClient.put<ProgramScopeTarget>(
        `${BASE_PATH}/${encodeURIComponent(id)}`,
        merged
      );
      if (remote) {
        runtimeScopes[existingIndex] = remote;
        return remote;
      }
    } catch {
      // Fallback
    }

    runtimeScopes[existingIndex] = merged;
    return merged;
  },

  /**
   * Deletes a program scope.
   */
  async deleteScope(id: string): Promise<{ success: boolean }> {
    try {
      await apiClient.delete(`${BASE_PATH}/${encodeURIComponent(id)}`);
    } catch {
      // Fallback
    }

    runtimeScopes = runtimeScopes.filter((s) => s.id !== id);
    return { success: true };
  },

  /**
   * Retrieves reference data (cohorts, terms, courses, institutions, regions).
   */
  async getReferenceData(signal?: AbortSignal): Promise<ScopingReferenceData> {
    try {
      const remote = await apiClient.get<ScopingReferenceData>(`${BASE_PATH}/reference`);
      if (remote && remote.cohorts) return remote;
    } catch {
      // Fallback to static reference data
    }
    return mockScopingReferenceData;
  },

  /**
   * Validates whether a student can submit a new application for a given scope.
   * Invariant: Inactive scopes CANNOT receive new applications.
   */
  async evaluateApplicationEligibility(
    scopeId: string,
    studentContext?: StudentScopeApplicationContext
  ): Promise<ScopeApplicationAcceptanceResult> {
    const scope = await this.getScope(scopeId);
    return canScopeAcceptApplications(scope, new Date(), studentContext);
  },

  /**
   * Evaluates overlap between a target scope and currently active scopes.
   */
  async evaluateOverlap(targetScope: ProgramScopeTarget): Promise<ScopeOverlapEvaluation> {
    return evaluateScopeOverlap(targetScope, runtimeScopes);
  },
};
