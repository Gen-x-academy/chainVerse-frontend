import type {
  ScholarshipApplicationInput,
  ScholarshipApplicationRecord,
  ScholarshipSubmissionReceipt,
} from '../types';

const DEFAULT_PROGRAM_VERSION = 'v1';

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

async function digestHex(input: string): Promise<string> {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && 'subtle' in globalThis.crypto) {
    const bytes = new TextEncoder().encode(input);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');
  }

  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    const charCode = input.charCodeAt(index);
    hash ^= charCode;
    hash = Math.imul(hash, 16777619);
  }

  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return hex;
}

export function sanitizeApplicationForReceipt(
  input: ScholarshipApplicationInput | ScholarshipApplicationRecord,
): Omit<ScholarshipApplicationRecord, 'id' | 'status' | 'createdAt'> & {
  id?: string;
  status?: 'submitted';
  createdAt?: string;
} {
  const { answers, ...rest } = input;
  void answers;
  return { ...rest };
}

export async function createIntegrityCommitment(
  payload: Record<string, string | number | boolean | null>,
): Promise<string> {
  return digestHex(stableStringify(payload));
}

export async function generateSubmissionReceipt(
  application: ScholarshipApplicationInput | ScholarshipApplicationRecord,
): Promise<ScholarshipSubmissionReceipt> {
  const applicationId = application.id ?? `scholarship-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const programVersion = application.programVersion ?? DEFAULT_PROGRAM_VERSION;
  const submittedAt = application.submittedAt ?? new Date().toISOString();

  const canonicalPayload = {
    applicationId,
    programVersion,
    submittedAt,
    status: 'submitted',
  } satisfies Record<string, string | number | boolean | null>;

  return {
    applicationId,
    programVersion,
    submittedAt,
    status: 'submitted',
    integrityCommitment: await createIntegrityCommitment(canonicalPayload),
  };
}

export const createSubmissionReceipt = generateSubmissionReceipt;

export async function verifySubmissionReceipt(
  receipt: Pick<ScholarshipSubmissionReceipt, 'applicationId' | 'programVersion' | 'submittedAt' | 'integrityCommitment'>,
  application: Pick<ScholarshipApplicationInput | ScholarshipApplicationRecord, 'id' | 'programVersion' | 'submittedAt'>,
): Promise<boolean> {
  const applicationId = application.id ?? receipt.applicationId;
  const programVersion = application.programVersion ?? receipt.programVersion;
  const submittedAt = application.submittedAt ?? receipt.submittedAt;

  const candidate = await createIntegrityCommitment({
    applicationId,
    programVersion,
    submittedAt,
    status: 'submitted',
  });

  return candidate === receipt.integrityCommitment;
}
