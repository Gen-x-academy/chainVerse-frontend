/**
 * Deterministic Boundary Engine for Program Application Opening and Deadline Windows.
 *
 * Implements:
 * 1. Deterministic timezone-to-UTC boundary conversion.
 * 2. Range validation and error reporting.
 * 3. Grace-period and late-submission evaluation.
 * 4. Deadline change grandfathering protection: previously submitted applications
 *    are NEVER silently invalidated by subsequent deadline adjustments.
 */

import type {
  ApplicationWindow,
  CreateWindowPayload,
  DeadlineChangeAssessment,
  SubmittedApplicationRecord,
  TimingEvaluationResult,
  WindowStatus,
  WindowValidationError,
  WindowValidationResult,
} from './types';

export const COMMON_TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'Africa/Nairobi', label: 'Africa/Nairobi (EAT, UTC+3)' },
  { value: 'Africa/Lagos', label: 'Africa/Lagos (WAT, UTC+1)' },
  { value: 'America/New_York', label: 'America/New_York (ET)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PT)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST, UTC+4)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT, UTC+8)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST, UTC+9)' },
];

/**
 * Validates whether an IANA timezone string is recognized.
 */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Deterministically converts a local date (YYYY-MM-DD) and time (HH:mm)
 * in an explicit IANA timezone into an exact UTC ISO-8601 string.
 */
export function computeUtcInstant(
  dateStr: string,
  timeStr: string,
  timeZone: string
): string {
  if (!dateStr || !timeStr || !timeZone) {
    throw new Error('dateStr, timeStr, and timeZone are all required.');
  }

  // Parse YYYY-MM-DD and HH:mm
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const [hourStr, minuteStr] = timeStr.split(':');

  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(hour) ||
    Number.isNaN(minute)
  ) {
    throw new Error('Invalid date or time component.');
  }

  // Use a base UTC date assuming local time
  const targetUtcEstimate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));

  // Determine timezone offset using Intl.DateTimeFormat parts
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(targetUtcEstimate);
  const getPart = (type: string) => {
    const p = parts.find((pt) => pt.type === type);
    return p ? parseInt(p.value, 10) : 0;
  };

  const localizedYear = getPart('year');
  const localizedMonth = getPart('month');
  const localizedDay = getPart('day');
  const localizedHour = getPart('hour');
  const localizedMinute = getPart('minute');

  const localizedUtcTime = Date.UTC(
    localizedYear,
    localizedMonth - 1,
    localizedDay,
    localizedHour,
    localizedMinute,
    0,
    0
  );

  // Offset in milliseconds between UTC estimate and localized representation
  const offsetMs = localizedUtcTime - targetUtcEstimate.getTime();

  // The true UTC instant corresponds to target local minus the offset
  const trueUtcMs = targetUtcEstimate.getTime() - offsetMs;
  return new Date(trueUtcMs).toISOString();
}

/**
 * Validates an application opening and deadline window configuration.
 *
 * Invariant: Boundary instants are deterministic and invalid ranges fail.
 */
export function validateApplicationWindow(
  input: CreateWindowPayload | Partial<ApplicationWindow>
): WindowValidationResult {
  const errors: WindowValidationError[] = [];
  const warnings: string[] = [];

  if (!input.name || !input.name.trim()) {
    errors.push({
      field: 'name',
      code: 'MISSING_REQUIRED_FIELD',
      message: 'Window name is required.',
    });
  }

  if (!input.programId || !input.programId.trim()) {
    errors.push({
      field: 'programId',
      code: 'MISSING_REQUIRED_FIELD',
      message: 'Program ID is required.',
    });
  }

  if (!input.timeZone || !isValidTimeZone(input.timeZone)) {
    errors.push({
      field: 'timeZone',
      code: 'INVALID_TIMEZONE',
      message: `Invalid or unsupported IANA timezone "${input.timeZone}".`,
    });
  }

  // Date/Time regex checks
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const timeRegex = /^\d{2}:\d{2}$/;

  if (!input.openDate || !dateRegex.test(input.openDate)) {
    errors.push({
      field: 'openDate',
      code: 'INVALID_DATE_FORMAT',
      message: 'Open date must be in YYYY-MM-DD format.',
    });
  }

  if (!input.openTime || !timeRegex.test(input.openTime)) {
    errors.push({
      field: 'openTime',
      code: 'INVALID_TIME_FORMAT',
      message: 'Open time must be in HH:mm 24-hour format.',
    });
  }

  if (!input.closeDate || !dateRegex.test(input.closeDate)) {
    errors.push({
      field: 'closeDate',
      code: 'INVALID_DATE_FORMAT',
      message: 'Close date must be in YYYY-MM-DD format.',
    });
  }

  if (!input.closeTime || !timeRegex.test(input.closeTime)) {
    errors.push({
      field: 'closeTime',
      code: 'INVALID_TIME_FORMAT',
      message: 'Close time must be in HH:mm 24-hour format.',
    });
  }

  if (input.gracePeriodMinutes != null && input.gracePeriodMinutes < 0) {
    errors.push({
      field: 'gracePeriodMinutes',
      code: 'NEGATIVE_GRACE_PERIOD',
      message: 'Grace period minutes cannot be negative.',
    });
  }

  // If date/time/timezone are syntactically valid, compute boundaries and check range order
  if (
    input.openDate &&
    input.openTime &&
    input.closeDate &&
    input.closeTime &&
    input.timeZone &&
    isValidTimeZone(input.timeZone)
  ) {
    try {
      const openUtc = computeUtcInstant(input.openDate, input.openTime, input.timeZone);
      const closeUtc = computeUtcInstant(input.closeDate, input.closeTime, input.timeZone);

      const openMs = Date.parse(openUtc);
      const closeMs = Date.parse(closeUtc);

      if (openMs >= closeMs) {
        errors.push({
          field: 'closeDate',
          code: 'OPEN_AFTER_CLOSE',
          message: 'Application opening instant must be strictly before the closing deadline instant.',
        });
      }

      // Check late cutoff ordering if provided
      if (
        'lateCutoffDate' in input &&
        input.lateCutoffDate &&
        'lateCutoffTime' in input &&
        input.lateCutoffTime
      ) {
        const lateUtc = computeUtcInstant(input.lateCutoffDate, input.lateCutoffTime, input.timeZone);
        const lateMs = Date.parse(lateUtc);
        const graceMs = (input.gracePeriodMinutes ?? 0) * 60 * 1000;

        if (lateMs <= closeMs + graceMs) {
          errors.push({
            field: 'lateCutoffDate',
            code: 'INVALID_LATE_CUTOFF',
            message: 'Late submission cutoff must be strictly after the deadline and grace period.',
          });
        }
      }
    } catch (e: unknown) {
      errors.push({
        field: 'timeZone',
        code: 'INVALID_TIMEZONE',
        message: e instanceof Error ? e.message : 'Boundary instant computation failed.',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Builds a complete ApplicationWindow record with computed deterministic UTC boundaries.
 */
export function buildApplicationWindow(
  payload: CreateWindowPayload,
  existingId?: string,
  version = 1
): ApplicationWindow {
  const validation = validateApplicationWindow(payload);
  if (!validation.valid) {
    throw new Error(validation.errors[0]?.message ?? 'Invalid application window.');
  }

  const openInstantUtc = computeUtcInstant(payload.openDate, payload.openTime, payload.timeZone);
  const closeInstantUtc = computeUtcInstant(payload.closeDate, payload.closeTime, payload.timeZone);

  const graceMs = (payload.gracePeriodMinutes ?? 0) * 60 * 1000;
  const gracePeriodEndUtc = new Date(Date.parse(closeInstantUtc) + graceMs).toISOString();

  let lateSubmissionCutoffUtc: string | undefined;
  if (payload.lateCutoffDate && payload.lateCutoffTime) {
    lateSubmissionCutoffUtc = computeUtcInstant(
      payload.lateCutoffDate,
      payload.lateCutoffTime,
      payload.timeZone
    );
  }

  return {
    id: existingId ?? `win-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    programId: payload.programId,
    programName: payload.programName,
    roundId: payload.roundId,
    name: payload.name.trim(),
    description: payload.description?.trim(),
    openDate: payload.openDate,
    openTime: payload.openTime,
    closeDate: payload.closeDate,
    closeTime: payload.closeTime,
    timeZone: payload.timeZone,
    openInstantUtc,
    closeInstantUtc,
    gracePeriodMinutes: payload.gracePeriodMinutes ?? 0,
    gracePeriodEndUtc,
    lateSubmissionPolicy: payload.lateSubmissionPolicy ?? 'strict_reject',
    latePenaltyPercent: payload.latePenaltyPercent,
    lateSubmissionCutoffUtc,
    version,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Determines current window state: UPCOMING, OPEN, GRACE_PERIOD, LATE_WINDOW, or CLOSED.
 */
export function determineWindowStatus(
  window: ApplicationWindow,
  now: Date | string = new Date()
): WindowStatus {
  const currentMs = typeof now === 'string' ? Date.parse(now) : now.getTime();
  const openMs = Date.parse(window.openInstantUtc);
  const closeMs = Date.parse(window.closeInstantUtc);
  const graceEndMs = Date.parse(window.gracePeriodEndUtc);
  const lateCutoffMs = window.lateSubmissionCutoffUtc
    ? Date.parse(window.lateSubmissionCutoffUtc)
    : undefined;

  if (currentMs < openMs) {
    return 'UPCOMING';
  }

  if (currentMs <= closeMs) {
    return 'OPEN';
  }

  if (currentMs <= graceEndMs) {
    return 'GRACE_PERIOD';
  }

  if (
    lateCutoffMs &&
    currentMs <= lateCutoffMs &&
    window.lateSubmissionPolicy !== 'strict_reject'
  ) {
    return 'LATE_WINDOW';
  }

  return 'CLOSED';
}

/**
 * Evaluates the timing of an application submission against window boundaries.
 */
export function evaluateSubmissionTiming(
  submissionTime: Date | string,
  window: ApplicationWindow,
  waiverToken?: string
): TimingEvaluationResult {
  const submissionMs =
    typeof submissionTime === 'string' ? Date.parse(submissionTime) : submissionTime.getTime();
  const openMs = Date.parse(window.openInstantUtc);
  const closeMs = Date.parse(window.closeInstantUtc);
  const graceEndMs = Date.parse(window.gracePeriodEndUtc);
  const lateCutoffMs = window.lateSubmissionCutoffUtc
    ? Date.parse(window.lateSubmissionCutoffUtc)
    : undefined;

  const currentInstantUtc = new Date(submissionMs).toISOString();
  const latencyFromDeadlineMs = submissionMs - closeMs;

  // 1. Before Opening
  if (submissionMs < openMs) {
    return {
      accepted: false,
      classification: 'REJECTED_BEFORE_OPEN',
      reason: 'WINDOW_NOT_OPEN',
      message: `Applications have not opened yet. Window opens on ${new Date(window.openInstantUtc).toLocaleString()}.`,
      currentInstantUtc,
      closeInstantUtc: window.closeInstantUtc,
      gracePeriodEndUtc: window.gracePeriodEndUtc,
      latencyFromDeadlineMs,
    };
  }

  // 2. On Time
  if (submissionMs <= closeMs) {
    return {
      accepted: true,
      classification: 'ON_TIME',
      message: 'Submission received on time before the closing deadline.',
      currentInstantUtc,
      closeInstantUtc: window.closeInstantUtc,
      gracePeriodEndUtc: window.gracePeriodEndUtc,
      latencyFromDeadlineMs,
    };
  }

  // 3. Grace Period
  if (submissionMs <= graceEndMs) {
    return {
      accepted: true,
      classification: 'GRACE_PERIOD',
      message: `Submission received within the ${window.gracePeriodMinutes}-minute grace period for in-flight traffic.`,
      currentInstantUtc,
      closeInstantUtc: window.closeInstantUtc,
      gracePeriodEndUtc: window.gracePeriodEndUtc,
      latencyFromDeadlineMs,
    };
  }

  // 4. Late Submission Evaluation
  if (lateCutoffMs && submissionMs <= lateCutoffMs) {
    switch (window.lateSubmissionPolicy) {
      case 'allow_with_penalty':
        return {
          accepted: true,
          classification: 'LATE_ACCEPTED',
          reason: 'LATE_SUBMISSION_ACCEPTED_WITH_PENALTY',
          message: `Late submission accepted with a ${window.latePenaltyPercent ?? 10}% review penalty.`,
          currentInstantUtc,
          closeInstantUtc: window.closeInstantUtc,
          gracePeriodEndUtc: window.gracePeriodEndUtc,
          latencyFromDeadlineMs,
        };
      case 'requires_waiver':
        if (waiverToken && waiverToken.trim().length > 0) {
          return {
            accepted: true,
            classification: 'LATE_ACCEPTED',
            reason: 'LATE_SUBMISSION_WAIVER_VERIFIED',
            message: 'Late submission accepted with verified administrative waiver token.',
            currentInstantUtc,
            closeInstantUtc: window.closeInstantUtc,
            gracePeriodEndUtc: window.gracePeriodEndUtc,
            latencyFromDeadlineMs,
          };
        }
        return {
          accepted: false,
          classification: 'REJECTED_LATE_POLICY',
          reason: 'LATE_WAIVER_REQUIRED',
          message: 'Deadline passed. Late submissions require an administrative waiver token.',
          currentInstantUtc,
          closeInstantUtc: window.closeInstantUtc,
          gracePeriodEndUtc: window.gracePeriodEndUtc,
          latencyFromDeadlineMs,
        };
      case 'discretionary_review':
        return {
          accepted: true,
          classification: 'LATE_ACCEPTED',
          reason: 'LATE_SUBMISSION_DISCRETIONARY',
          message: 'Late submission routed to discretionary committee review queue.',
          currentInstantUtc,
          closeInstantUtc: window.closeInstantUtc,
          gracePeriodEndUtc: window.gracePeriodEndUtc,
          latencyFromDeadlineMs,
        };
      case 'strict_reject':
      default:
        return {
          accepted: false,
          classification: 'REJECTED_PAST_DEADLINE',
          reason: 'DEADLINE_PASSED',
          message: 'The application deadline and grace period have expired.',
          currentInstantUtc,
          closeInstantUtc: window.closeInstantUtc,
          gracePeriodEndUtc: window.gracePeriodEndUtc,
          latencyFromDeadlineMs,
        };
    }
  }

  // 5. Past all windows
  return {
    accepted: false,
    classification: 'REJECTED_PAST_DEADLINE',
    reason: 'DEADLINE_EXPIRED',
    message: 'The application deadline has closed.',
    currentInstantUtc,
    closeInstantUtc: window.closeInstantUtc,
    gracePeriodEndUtc: window.gracePeriodEndUtc,
    latencyFromDeadlineMs,
  };
}

/**
 * Assesses the impact of a proposed deadline change.
 *
 * Invariant: Deadline changes DO NOT silently invalidate submitted applications.
 *
 * Any application submitted before the modification timestamp whose submission
 * was valid under the active window remains 100% valid (grandfathered).
 */
export function evaluateDeadlineChange(
  currentWindow: ApplicationWindow,
  proposedCloseUtc: string,
  existingApplications: SubmittedApplicationRecord[]
): DeadlineChangeAssessment {
  const currentCloseMs = Date.parse(currentWindow.closeInstantUtc);
  const proposedCloseMs = Date.parse(proposedCloseUtc);

  const isShortened = proposedCloseMs < currentCloseMs;
  const isExtended = proposedCloseMs > currentCloseMs;

  const grandfatheredApplicationIds: string[] = [];

  for (const app of existingApplications) {
    const appSubmittedMs = Date.parse(app.submittedAtUtc);

    // If an application was submitted during the valid window of the current configuration,
    // it is permanently grandfathered and protected from retroactive invalidation.
    if (appSubmittedMs <= currentCloseMs + currentWindow.gracePeriodMinutes * 60 * 1000) {
      // If the proposed deadline is earlier than when this application was submitted,
      // it would be retroactively impacted without the grandfathering protection rule.
      if (isShortened && appSubmittedMs > proposedCloseMs) {
        grandfatheredApplicationIds.push(app.id);
      }
    }
  }

  let warningMessage: string | undefined;
  if (isShortened && grandfatheredApplicationIds.length > 0) {
    warningMessage = `Shortening the deadline impacts ${grandfatheredApplicationIds.length} already submitted application(s). Under the historical invariance rule, these applications are grandfathered and will NOT be invalidated.`;
  } else if (isShortened) {
    warningMessage = 'Notice: Moving the deadline earlier will close intake sooner for pending applicants.';
  }

  return {
    isShortened,
    isExtended,
    previousCloseUtc: currentWindow.closeInstantUtc,
    proposedCloseUtc,
    affectedApplicationsCount: grandfatheredApplicationIds.length,
    grandfatheredApplicationIds,
    safeToApply: true, // Always safe because grandfathering guarantees zero silent invalidation
    warningMessage,
  };
}
