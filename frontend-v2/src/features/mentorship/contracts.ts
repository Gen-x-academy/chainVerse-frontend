/**
 * Versioned mentorship contracts (closes #1253, MENTOR-006).
 *
 * Commands, queries, and events crossing the mentorship boundary move through
 * explicit envelopes so a wording or shape change can never silently
 * reinterpret an in-flight record. The module pins:
 *
 * 1. **Envelope versioning.** Every payload declares the contract it belongs
 *    to and the schema version it was written against. Unknown contracts and
 *    deprecated versions are rejected with stable error codes.
 * 2. **Primitive schemas.** Payments are integer minor units with an explicit
 *    currency (never floats), list queries are page >= 1 with a bounded page
 *    size, engagement windows are ISO 8601 with the end strictly after the
 *    start, and evidence references carry an opaque id plus an optional SHA-256.
 * 3. **Nullable versus omitted.** A field typed `T | null` means "known to be
 *    empty"; an optional field means "not sent". Nothing else is valid.
 * 4. **Correlation ids.** Every envelope carries one, so retries are
 *    deduplicated and an event can always be traced back to its command.
 *
 * Contract changes are coordinated with the contracts repository (see
 * `docs/mentorship/MENTOR-006-versioned-contracts.md`).
 */

import { type EngagementState } from './glossary';

export const MENTORSHIP_CONTRACTS_VERSION = '1.0.0' as const;

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Integer minor units only; a float amount is always invalid. */
export interface MentorshipMoney {
  amountMinorUnits: number;
  currency: 'XLM' | 'USDC';
}

/** List queries are 1-indexed with a bounded, defaultable page size. */
export interface MentorshipPaginationQuery {
  page: number;
  pageSize: number;
}

export const MENTORSHIP_DEFAULT_PAGE_SIZE = 20;
export const MENTORSHIP_MAX_PAGE_SIZE = 100;

/** ISO 8601 window; `endsAt` is optional but must start after it begins. */
export interface MentorshipContractWindow {
  startsAt: string;
  endsAt?: string;
}

export interface MentorshipEvidenceRef {
  id: string;
  uri: string;
  sha256?: string;
  capturedAt?: string;
}

export const MENTORSHIP_CONTRACT_ERROR_CODES = [
  'UNKNOWN_CONTRACT',
  'UNSUPPORTED_CONTRACT_VERSION',
  'MISSING_CORRELATION_ID',
  'SCHEMA_VALIDATION_FAILED',
] as const;

export type MentorshipContractErrorCode = (typeof MENTORSHIP_CONTRACT_ERROR_CODES)[number];

export interface MentorshipContractViolation {
  code: MentorshipContractErrorCode;
  field: string;
  message: string;
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

export function validateMentorshipMoney(value: unknown): MentorshipContractViolation[] {
  if (value === null || typeof value !== 'object') {
    return [{ code: 'SCHEMA_VALIDATION_FAILED', field: 'money', message: 'Money must be an object.' }];
  }
  const money = value as MentorshipMoney;
  const violations: MentorshipContractViolation[] = [];
  if (
    typeof money.amountMinorUnits !== 'number' ||
    !Number.isInteger(money.amountMinorUnits) ||
    money.amountMinorUnits < 0
  ) {
    violations.push({
      code: 'SCHEMA_VALIDATION_FAILED',
      field: 'amountMinorUnits',
      message: 'amountMinorUnits must be a non-negative integer.',
    });
  }
  if (money.currency !== 'XLM' && money.currency !== 'USDC') {
    violations.push({
      code: 'SCHEMA_VALIDATION_FAILED',
      field: 'currency',
      message: 'currency must be XLM or USDC.',
    });
  }
  return violations;
}

export function validateMentorshipPagination(value: unknown): MentorshipContractViolation[] {
  if (value === null || typeof value !== 'object') {
    return [
      { code: 'SCHEMA_VALIDATION_FAILED', field: 'pagination', message: 'Pagination must be an object.' },
    ];
  }
  const query = value as MentorshipPaginationQuery;
  const violations: MentorshipContractViolation[] = [];
  if (typeof query.page !== 'number' || !Number.isInteger(query.page) || query.page < 1) {
    violations.push({
      code: 'SCHEMA_VALIDATION_FAILED',
      field: 'page',
      message: 'page must be an integer of at least 1.',
    });
  }
  if (
    typeof query.pageSize !== 'number' ||
    !Number.isInteger(query.pageSize) ||
    query.pageSize < 1 ||
    query.pageSize > MENTORSHIP_MAX_PAGE_SIZE
  ) {
    violations.push({
      code: 'SCHEMA_VALIDATION_FAILED',
      field: 'pageSize',
      message: `pageSize must be between 1 and ${MENTORSHIP_MAX_PAGE_SIZE}.`,
    });
  }
  return violations;
}

export function validateMentorshipWindow(value: unknown): MentorshipContractViolation[] {
  if (value === null || typeof value !== 'object') {
    return [{ code: 'SCHEMA_VALIDATION_FAILED', field: 'window', message: 'Window must be an object.' }];
  }
  const window = value as MentorshipContractWindow;
  const violations: MentorshipContractViolation[] = [];
  if (!isIsoDateTime(window.startsAt)) {
    violations.push({
      code: 'SCHEMA_VALIDATION_FAILED',
      field: 'startsAt',
      message: 'startsAt must be an ISO 8601 date.',
    });
    return violations;
  }
  if (window.endsAt !== undefined) {
    if (!isIsoDateTime(window.endsAt)) {
      violations.push({
        code: 'SCHEMA_VALIDATION_FAILED',
        field: 'endsAt',
        message: 'endsAt must be an ISO 8601 date.',
      });
    } else if (Date.parse(window.endsAt) <= Date.parse(window.startsAt)) {
      violations.push({
        code: 'SCHEMA_VALIDATION_FAILED',
        field: 'endsAt',
        message: 'endsAt must be strictly after startsAt.',
      });
    }
  }
  return violations;
}

export function validateMentorshipEvidenceRef(value: unknown): MentorshipContractViolation[] {
  if (value === null || typeof value !== 'object') {
    return [{ code: 'SCHEMA_VALIDATION_FAILED', field: 'evidenceRef', message: 'EvidenceRef must be an object.' }];
  }
  const ref = value as MentorshipEvidenceRef;
  const violations: MentorshipContractViolation[] = [];
  if (typeof ref.id !== 'string' || ref.id.trim().length === 0) {
    violations.push({ code: 'SCHEMA_VALIDATION_FAILED', field: 'id', message: 'id is required.' });
  }
  if (typeof ref.uri !== 'string' || ref.uri.trim().length === 0) {
    violations.push({ code: 'SCHEMA_VALIDATION_FAILED', field: 'uri', message: 'uri is required.' });
  }
  if (ref.sha256 !== undefined && !/^[a-f0-9]{64}$/.test(ref.sha256)) {
    violations.push({
      code: 'SCHEMA_VALIDATION_FAILED',
      field: 'sha256',
      message: 'sha256 must be 64 lowercase hex characters.',
    });
  }
  if (ref.capturedAt !== undefined && !isIsoDateTime(ref.capturedAt)) {
    violations.push({
      code: 'SCHEMA_VALIDATION_FAILED',
      field: 'capturedAt',
      message: 'capturedAt must be an ISO 8601 date.',
    });
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

export const MENTORSHIP_CONTRACT_NAMES = [
  'engagement.create',
  'engagement.transition',
  'payment.quote',
] as const;

export type MentorshipContractName = (typeof MENTORSHIP_CONTRACT_NAMES)[number];

export interface EngagementCreatePayload {
  programId: string;
  mentorId: string;
  menteeId: string;
  window: MentorshipContractWindow;
}

export interface EngagementTransitionPayload {
  engagementId: string;
  from: EngagementState;
  to: EngagementState;
  reason: string;
}

export interface PaymentQuotePayload {
  engagementId: string;
  money: MentorshipMoney;
  window: MentorshipContractWindow;
}

export interface MentorshipContractEnvelope<TPayload> {
  contract: MentorshipContractName;
  version: string;
  correlationId: string;
  issuedAt: string;
  payload: TPayload;
}

export interface ContractRegistration {
  /** Newest schema version the client can speak. */
  latestVersion: string;
  /** Versions the current client still accepts. */
  supportedVersions: readonly string[];
  /** Versions that must be rewritten before the platform can process them. */
  deprecatedVersions: readonly string[];
  validate: (payload: unknown) => MentorshipContractViolation[];
  /** Human-readable compatibility note surfaced on the contracts page. */
  compatibility: string;
}

function requireObject(value: unknown, field: string): MentorshipContractViolation[] {
  if (value === null || typeof value !== 'object') {
    return [{ code: 'SCHEMA_VALIDATION_FAILED', field, message: 'Payload must be an object.' }];
  }
  return [];
}

function requireString(payload: Record<string, unknown>, field: string): MentorshipContractViolation[] {
  if (typeof payload[field] !== 'string' || (payload[field] as string).trim().length === 0) {
    return [
      { code: 'SCHEMA_VALIDATION_FAILED', field, message: `${field} is required.` },
    ];
  }
  return [];
}

export const MENTORSHIP_CONTRACT_REGISTRY: readonly (ContractRegistration & {
  contract: MentorshipContractName;
})[] = [
  {
    contract: 'engagement.create',
    latestVersion: '1.0.0',
    supportedVersions: ['1.0.0'],
    deprecatedVersions: [],
    compatibility: 'v1: program/mentor/mentee ids plus an ISO window.',
    validate: (payload) => {
      const base = requireObject(payload, 'payload');
      if (base.length > 0) return base;
      const record = payload as Record<string, unknown>;
      return [
        ...requireString(record, 'programId'),
        ...requireString(record, 'mentorId'),
        ...requireString(record, 'menteeId'),
        ...validateMentorshipWindow(record.window),
      ];
    },
  },
  {
    contract: 'engagement.transition',
    latestVersion: '1.0.0',
    supportedVersions: ['1.0.0'],
    deprecatedVersions: [],
    compatibility: 'v1: membership in the MENTOR-001 engagement lifecycle table.',
    validate: (payload) => {
      const base = requireObject(payload, 'payload');
      if (base.length > 0) return base;
      const record = payload as Record<string, unknown>;
      if (typeof record.to !== 'string' || record.to.trim().length === 0) {
        return [{ code: 'SCHEMA_VALIDATION_FAILED', field: 'to', message: 'to is required.' }];
      }
      return [
        ...requireString(record, 'engagementId'),
        ...requireString(record, 'reason'),
      ] as MentorshipContractViolation[];
    },
  },
  {
    contract: 'payment.quote',
    latestVersion: '1.0.0',
    supportedVersions: ['1.0.0'],
    deprecatedVersions: [],
    compatibility:
      'v1: quotes in integer minor units (XLM or USDC); quotes never settle while a dispute is open.',
    validate: (payload) => {
      const base = requireObject(payload, 'payload');
      if (base.length > 0) return base;
      const record = payload as Record<string, unknown>;
      return [
        ...requireString(record, 'engagementId'),
        ...validateMentorshipMoney(record.money),
        ...validateMentorshipWindow(record.window),
      ];
    },
  },
];

export function findContractRegistration(
  contract: MentorshipContractName,
): ContractRegistration & { contract: MentorshipContractName } | undefined {
  return MENTORSHIP_CONTRACT_REGISTRY.find((entry) => entry.contract === contract);
}

export function isContractVersionSupported(
  contract: MentorshipContractName,
  version: string,
): boolean {
  const registration = findContractRegistration(contract);
  if (!registration) return false;
  return registration.supportedVersions.includes(version);
}

export function isContractVersionDeprecated(
  contract: MentorshipContractName,
  version: string,
): boolean {
  const registration = findContractRegistration(contract);
  if (!registration) return false;
  return registration.deprecatedVersions.includes(version);
}

/**
 * Validates a full envelope: known contract, supported (non-deprecated)
 * version, correlation id present, ISO issuedAt, and a payload that passes the
 * registered validator.
 */
export function validateContractEnvelope(
  envelope: unknown,
): MentorshipContractViolation[] {
  if (envelope === null || typeof envelope !== 'object') {
    return [{ code: 'UNKNOWN_CONTRACT', field: 'envelope', message: 'Envelope must be an object.' }];
  }
  const candidate = envelope as MentorshipContractEnvelope<unknown>;
  const violations: MentorshipContractViolation[] = [];

  if (
    typeof candidate.contract !== 'string' ||
    !(MENTORSHIP_CONTRACT_NAMES as readonly string[]).includes(candidate.contract)
  ) {
    return [{ code: 'UNKNOWN_CONTRACT', field: 'contract', message: 'Unknown mentorship contract.' }];
  }

  const registration = findContractRegistration(candidate.contract);
  if (!registration) {
    return [{ code: 'UNKNOWN_CONTRACT', field: 'contract', message: 'Unregistered mentorship contract.' }];
  }

  if (typeof candidate.version !== 'string' || candidate.version.length === 0) {
    violations.push({
      code: 'UNSUPPORTED_CONTRACT_VERSION',
      field: 'version',
      message: 'version is required.',
    });
  } else if (isContractVersionDeprecated(candidate.contract, candidate.version)) {
    violations.push({
      code: 'UNSUPPORTED_CONTRACT_VERSION',
      field: 'version',
      message: `Contract version ${candidate.version} is deprecated; upgrade to ${registration.latestVersion} before sending.`,
    });
  } else if (!isContractVersionSupported(candidate.contract, candidate.version)) {
    violations.push({
      code: 'UNSUPPORTED_CONTRACT_VERSION',
      field: 'version',
      message: `Contract version ${candidate.version} is not supported by this client.`,
    });
  }

  if (typeof candidate.correlationId !== 'string' || candidate.correlationId.trim().length === 0) {
    violations.push({
      code: 'MISSING_CORRELATION_ID',
      field: 'correlationId',
      message: 'correlationId is required so retries can be deduplicated.',
    });
  }

  if (!isIsoDateTime(candidate.issuedAt)) {
    violations.push({
      code: 'SCHEMA_VALIDATION_FAILED',
      field: 'issuedAt',
      message: 'issuedAt must be an ISO 8601 date.',
    });
  }

  if (typeof candidate.version === 'string' && isContractVersionSupported(candidate.contract, candidate.version)) {
    violations.push(...registration.validate(candidate.payload));
  }

  return violations;
}
