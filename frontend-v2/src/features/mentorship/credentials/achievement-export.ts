/** MENTOR-100: export portable mentorship achievements as Open Badge-style credentials with an integrity proof. */
export interface Achievement {
  id: string;
  recipientId: string;
  mentorId: string;
  title: string;
  description?: string;
  issuedAt: string;
  criteria?: string;
  evidence?: string[];
  skills?: string[];
}

export interface IssuerMetadata {
  name: string;
  url: string;
}

/** Optional fields a recipient chooses to include when sharing. */
export type ShareableField = 'recipientId' | 'mentorId' | 'criteria' | 'evidence' | 'skills';

export const DEFAULT_SHARED_FIELDS: readonly ShareableField[] = ['skills', 'criteria'];

/** Fields that are always part of the credential and cannot be withheld. */
type CoreField = 'id' | 'title' | 'issuedAt';

export interface AchievementExport {
  '@context': string[];
  type: string[];
  issuer: IssuerMetadata;
  issuanceDate: string;
  credentialSubject: Required<Pick<Achievement, CoreField>> & Partial<Pick<Achievement, ShareableField | 'description'>>;
  proof: { type: string; created: string; value: string };
}

export const OPEN_BADGE_CONTEXT: readonly string[] = [
  'https://www.w3.org/2018/credentials/v1',
  'https://purl.imsglobal.org/spec/ob/v3p0/context.json',
];
export const PORTABLE_ACHIEVEMENT_TYPE: readonly string[] = ['VerifiableCredential', 'OpenBadgeCredential'];

export type Signer = (payload: string) => string;
export type Verifier = (payload: string, proof: string) => boolean;

/** Sorts object keys so the same credential always serialises to the same bytes. */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, sortKeys(v)]),
    );
  }
  return value;
}

export function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

/** Builds the signed payload an integrity proof is computed over. */
function proofPayload(issuer: IssuerMetadata, issuanceDate: string, subject: AchievementExport['credentialSubject']): string {
  return canonicalize({ issuer, issuanceDate, credentialSubject: subject });
}

/** Keeps only the fields the recipient agreed to share, plus the always-present core. */
export function selectSharedFields(achievement: Achievement, sharedFields: readonly ShareableField[]): AchievementExport['credentialSubject'] {
  const subject: AchievementExport['credentialSubject'] = {
    id: achievement.id,
    title: achievement.title,
    issuedAt: achievement.issuedAt,
  };
  for (const field of sharedFields) {
    if (field === 'mentorId') subject.mentorId = achievement.mentorId;
    if (field === 'recipientId') subject.recipientId = achievement.recipientId;
    if (field === 'criteria') subject.criteria = achievement.criteria;
    if (field === 'evidence') subject.evidence = achievement.evidence;
    if (field === 'skills') subject.skills = achievement.skills;
  }
  return subject;
}

export interface ExportAchievementInput {
  achievement: Achievement;
  issuer: IssuerMetadata;
  /** Optional fields to include; defaults to skills and criteria. */
  sharedFields?: readonly ShareableField[];
}

/**
 * Produces a portable credential. The proof is computed over the *shared* subject only,
 * so redacting a field before export still yields a credential that verifies.
 */
export function exportAchievement(input: ExportAchievementInput, sign: Signer, now: Date = new Date()): AchievementExport {
  const { achievement, issuer } = input;
  if (!issuer?.name || !issuer.url) throw new Error('Issuer metadata with a name and url is required');
  if (!achievement.id || !achievement.title || !achievement.issuedAt) {
    throw new Error('An achievement needs an id, title and issue date');
  }
  const sharedFields = input.sharedFields ?? DEFAULT_SHARED_FIELDS;
  const credentialSubject = selectSharedFields(achievement, sharedFields);
  const proofValue = sign(proofPayload(issuer, achievement.issuedAt, credentialSubject));
  return {
    '@context': [...OPEN_BADGE_CONTEXT],
    type: [...PORTABLE_ACHIEVEMENT_TYPE],
    issuer,
    issuanceDate: achievement.issuedAt,
    credentialSubject,
    proof: { type: 'DataIntegrityProof', created: now.toISOString(), value: proofValue },
  };
}

/** Recomputes the payload from the credential and delegates the cryptographic check to the caller. */
export function verifyAchievementExport(credential: AchievementExport, verify: Verifier): boolean {
  const payload = proofPayload(credential.issuer, credential.issuanceDate, credential.credentialSubject);
  return verify(payload, credential.proof.value);
}
