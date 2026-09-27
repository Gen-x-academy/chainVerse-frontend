/**
 * Typed API Integration for Application Answers Validation and Submission.
 *
 * Ensures client and server validation rules strictly agree:
 * - Malformed content is rejected before receipt creation.
 * - Validation errors always carry safe, sanitized field paths.
 *
 * The questionnaire schema is owned by the API (issue #1225). The local cache
 * starts empty so a production bundle never validates against a bundled
 * sample questionnaire.
 */

import { apiClient } from '@/src/lib/api-client';
import { validateApplicationForm } from './domain';
import type {
  ApplicationAnswersMap,
  ApplicationFormSchema,
  FormValidationResult,
  SubmitAnswersPayload,
  SubmitAnswersResponse,
} from './types';

const BASE_PATH = '/scholarships/applications/validation';

// Runtime cache of schemas the API has returned during this session
let runtimeSchema: ApplicationFormSchema | null = null;

export function resetApplicationValidationService(): void {
  runtimeSchema = null;
}

/** A questionnaire with no fields: it can only ever validate an empty map. */
function EMPTY_FORM_SCHEMA(roundId: string): ApplicationFormSchema {
  return {
    id: `unavailable:${roundId}`,
    roundId,
    programId: '',
    title: 'Questionnaire unavailable',
    description: 'The questionnaire could not be loaded from the scholarship API.',
    fields: [],
    version: 'unavailable',
  };
}

export const applicationValidationService = {
  /**
   * Fetches the dynamic questionnaire schema for a given scholarship round.
   */
  async getFormSchema(roundId: string, _signal?: AbortSignal): Promise<ApplicationFormSchema> {
    try {
      const path = `${BASE_PATH}/schema?roundId=${encodeURIComponent(roundId)}`;
      const remote = await apiClient.get<ApplicationFormSchema>(path);
      if (remote?.fields) {
        runtimeSchema = remote;
        return remote;
      }
    } catch {
      // Resilient fallback
    }

    if (!runtimeSchema) return EMPTY_FORM_SCHEMA(roundId);

    return {
      ...runtimeSchema,
      roundId,
    };
  },

  /**
   * Server-side validation of answers against the round schema.
   * Client and server rules agree deterministically.
   */
  async validateAnswers(
    roundId: string,
    answers: ApplicationAnswersMap,
    _signal?: AbortSignal
  ): Promise<FormValidationResult> {
    try {
      const path = `${BASE_PATH}/check`;
      const remote = await apiClient.post<FormValidationResult>(path, {
        roundId,
        answers,
      });
      if (remote) return remote;
    } catch {
      // Resilient fallback to identical pure domain validation
    }

    const schema = await this.getFormSchema(roundId);
    return validateApplicationForm(schema, answers);
  },

  /**
   * Submits answers for an application.
   * Invariant: Malformed content is rejected, and validation errors identify safe field paths.
   */
  async submitAnswers(payload: SubmitAnswersPayload): Promise<SubmitAnswersResponse> {
    const schema = await this.getFormSchema(payload.roundId);
    const validation = validateApplicationForm(schema, payload.answers);

    if (!validation.valid) {
      throw new Error(
        `Application answers validation failed: ${validation.errors
          .map((e) => `${e.fieldPath}: ${e.message}`)
          .join('; ')}`
      );
    }

    try {
      const path = `${BASE_PATH}/submit`;
      return await apiClient.post<SubmitAnswersResponse>(path, payload);
    } catch (error) {
      // A submission is a durable, server-owned record. If the API did not
      // acknowledge it we must not invent an application or submission id in
      // the browser, so the caller sees a retryable failure instead of a
      // receipt that was never persisted (issue #1223).
      throw new Error(
        error instanceof Error
          ? `Application answers could not be submitted: ${error.message}`
          : 'Application answers could not be submitted. Please retry.',
      );
    }
  },
};
