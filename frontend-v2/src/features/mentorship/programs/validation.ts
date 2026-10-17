/**
 * Draft validation for issue MENTOR-015.
 *
 * Drafts are private by default: they are validated before they are created
 * or published, and publishing is a separate, staff-only action.
 */

import type { CreateProgramPayload } from './types';

export interface ProgramValidationError {
  field: string;
  message: string;
}

export function validateProgramDraft(
  payload: CreateProgramPayload
): ProgramValidationError[] {
  const errors: ProgramValidationError[] = [];

  if (!payload.name.trim()) {
    errors.push({ field: 'name', message: 'Program name is required.' });
  }

  if (!payload.organizationId.trim()) {
    errors.push({
      field: 'organizationId',
      message: 'Owning organization is required.',
    });
  }

  if (payload.capacity < 0) {
    errors.push({ field: 'capacity', message: 'Capacity cannot be negative.' });
  }

  if (payload.durationWeeks < 1) {
    errors.push({
      field: 'durationWeeks',
      message: 'Duration must span at least one week.',
    });
  }

  if (Number.isNaN(Date.parse(payload.startsAt))) {
    errors.push({ field: 'startsAt', message: 'Start date must be an ISO 8601 date.' });
  }

  if (payload.endsAt && Date.parse(payload.endsAt) <= Date.parse(payload.startsAt)) {
    errors.push({
      field: 'endsAt',
      message: 'End date must follow the start date.',
    });
  }

  if (payload.audience.length === 0) {
    errors.push({ field: 'audience', message: 'Audience is required.' });
  }

  if (payload.outcomes.length === 0) {
    errors.push({ field: 'outcomes', message: 'Outcomes are required.' });
  }

  if (!payload.ownerUserId.trim()) {
    errors.push({ field: 'ownerUserId', message: 'Owner is required.' });
  }

  return errors;
}
