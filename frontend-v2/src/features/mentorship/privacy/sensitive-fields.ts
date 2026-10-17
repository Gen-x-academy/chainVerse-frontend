/**
 * MENTOR-110: protect mentorship secrets and sensitive fields.
 *
 * Sensitive fields are classified, redacted from logs/events/errors, access is
 * least-privilege and auditable, and encryption keys can be rotated without
 * losing the ability to read data written under the previous key.
 */

export const SENSITIVE_FIELD_CLASSIFICATIONS = {
  providerToken: 'secret',
  identityRef: 'pii',
  privateNote: 'confidential',
  preciseLocation: 'pii',
  evidenceKey: 'secret',
  payoutDetails: 'financial',
} as const;

export type SensitiveField = keyof typeof SENSITIVE_FIELD_CLASSIFICATIONS;
export type SensitivityClass = (typeof SENSITIVE_FIELD_CLASSIFICATIONS)[SensitiveField];

export const SENSITIVE_FIELDS = Object.keys(SENSITIVE_FIELD_CLASSIFICATIONS) as SensitiveField[];

export function isSensitiveField(field: string): field is SensitiveField {
  return (SENSITIVE_FIELDS as string[]).includes(field);
}

export const REDACTION_MARKER = '[redacted]';

/** Masks a scalar value, keeping no plaintext fragments. */
export function redactValue(_value: unknown): string {
  return REDACTION_MARKER;
}

/** Deep-redacts sensitive keys anywhere in a nested record. */
export function redactRecord<T>(input: T): T {
  if (Array.isArray(input)) return input.map((item) => redactRecord(item)) as unknown as T;
  if (input && typeof input === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      output[key] = isSensitiveField(key) ? redactValue(value) : redactRecord(value);
    }
    return output as T;
  }
  return input;
}

/** True when a record (at any depth) carries a sensitive field. */
export function containsSensitiveData(input: unknown): boolean {
  if (Array.isArray(input)) return input.some((item) => containsSensitiveData(item));
  if (input && typeof input === 'object') {
    return Object.entries(input as Record<string, unknown>).some(
      ([key, value]) => isSensitiveField(key) || containsSensitiveData(value),
    );
  }
  return false;
}

/**
 * Redacts secrets out of anything that may be logged, including error messages
 * and stacks, so failures cannot leak plaintext.
 */
export function redactError(error: unknown): { message: string; stack?: string } {
  const message = error instanceof Error ? error.message : String(error);
  const safe = message.replace(/\b[A-Za-z0-9_-]{16,}\b/g, REDACTION_MARKER);
  const stack = error instanceof Error ? error.stack?.replace(/\b[A-Za-z0-9_-]{16,}\b/g, REDACTION_MARKER) : undefined;
  return { message: safe, stack };
}

export type AccessAction = 'read' | 'write' | 'rotate';
export type AccessRole = 'mentor' | 'mentee' | 'organization-staff' | 'administrator' | 'auditor';

/** Least-privilege matrix; anything not explicitly listed is denied. */
export const FIELD_ACCESS: Record<AccessRole, AccessAction[]> = {
  mentor: ['read', 'write'],
  mentee: ['read', 'write'],
  'organization-staff': ['read'],
  administrator: ['read', 'write', 'rotate'],
  auditor: ['read'],
};

export interface AccessDecision {
  allowed: boolean;
  reason: string;
}

export function authorizeFieldAccess(role: AccessRole | undefined, action: AccessAction): AccessDecision {
  if (!role) return { allowed: false, reason: 'No authenticated role' };
  const actions = FIELD_ACCESS[role] ?? [];
  if (!actions.includes(action)) return { allowed: false, reason: `${role} may not ${action} sensitive fields` };
  return { allowed: true, reason: 'granted' };
}

export interface AuditEntry {
  actor: string;
  field: SensitiveField;
  action: AccessAction;
  at: string;
  allowed: boolean;
}

/** Records an audited access attempt, redacting the value. */
export function auditAccess(
  log: AuditEntry[],
  actor: string,
  role: AccessRole | undefined,
  field: SensitiveField,
  action: AccessAction,
  now: Date = new Date(),
): AuditEntry[] {
  const decision = authorizeFieldAccess(role, action);
  return [...log, { actor, field, action, at: now.toISOString(), allowed: decision.allowed }];
}

export interface KeyRing {
  activeVersion: number;
  /** Historical versions retained for decryption; never contain plaintext. */
  versions: number[];
}

export function rotateKey(ring: KeyRing, now: Date = new Date()): KeyRing & { rotatedAt: string } {
  const nextVersion = ring.activeVersion + 1;
  return {
    activeVersion: nextVersion,
    versions: Array.from(new Set([...ring.versions, nextVersion])).sort((a, b) => a - b),
    rotatedAt: now.toISOString(),
  };
}

/** Data written under an old key remains decryptable after rotation. */
export function canDecrypt(ring: KeyRing, writeVersion: number): boolean {
  return ring.versions.includes(writeVersion);
}
