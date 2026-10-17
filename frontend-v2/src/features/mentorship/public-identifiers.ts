/**
 * Stable public mentorship identifiers (closes #1252, MENTOR-005).
 *
 * The glossary (MENTOR-001, OP-4) owns the `aggregate_prefix` shape via
 * `mentorshipId()`; this module owns where the opaque part comes from. Three
 * rules are enforced here:
 *
 * 1. **Never display-derived.** The opaque part is generated or derived from
 *    non-personal source keys only. A name-like or email-like opaque value is
 *    rejected before it can ever be embedded in a public id, so renaming a
 *    person or organization never orphans a record.
 * 2. **Stable and collision-resistant.** Deriving from the same source key
 *    always yields the same public id (safe for CSV re-exports and replays),
 *    while fresh generation mixes a UUID with wall-clock entropy.
 * 3. **Paired correlation ids.** Every public id can carry a derived
 *    correlation id used to group retries and event logs without exposing
 *    user identity.
 */

import { mentorshipId, isMentorshipId, type MentorshipAggregate } from './glossary';

export const MENTORSHIP_IDENTIFIER_VERSION = '1.0.0' as const;

/** Fallback width so short digests still read as opaque keys. */
const MIN_OPAQUE_WIDTH = 12;

/** Small deterministic hash (djb2) so no runtime dependency is required. */
function hashToBase36(input: string): string {
  let value = 5381;
  for (let index = 0; index < input.length; index += 1) {
    value = (value * 33) ^ input.charCodeAt(index);
  }
  return (value >>> 0).toString(36).padStart(MIN_OPAQUE_WIDTH, '0');
}

/**
 * True when the opaque value still smells like identity data (an email or a
 * display name with spaces). Public ids are built from opaque source keys
 * only.
 */
export function opaqueIsDisplayLike(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.includes('@') || /\s/.test(trimmed) || trimmed.length === 0;
}

/** Guard used before any display-born value can enter an identifier. */
export function assertNotDisplayDerived(
  aggregate: MentorshipAggregate,
  opaque: string,
): void {
  if (opaqueIsDisplayLike(opaque)) {
    throw new Error(
      `A ${aggregate} id must not be derived from a name, an email, or blank input.`,
    );
  }
}

/**
 * Derives the stable public id for a source key the backend already issued
 * (for example a UUID or numeric key). Deterministic: the same source key
 * always produces the same public id across exports and replays.
 */
export function buildStablePublicId(
  aggregate: MentorshipAggregate,
  source: { apiKey: string },
): string {
  assertNotDisplayDerived(aggregate, source.apiKey);
  const opaque = hashToBase36(source.apiKey);
  return mentorshipId(aggregate, opaque);
}

/**
 * Generates a fresh opaque part from platform entropy (UUID when available,
 * wall clock with a counter as the deterministic fallback in tests).
 */
export function generateMentorshipOpaqueId(): string {
  const globalCrypto = typeof crypto !== 'undefined' ? crypto : undefined;
  if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
    return globalCrypto.randomUUID().replace(/-/g, '').slice(0, 16);
  }
  return `${Date.now().toString(36)}${Date.now() % 97}`;
}

/** Generates a fresh, well-formed public id. */
export function generateMentorshipId(aggregate: MentorshipAggregate): string {
  return mentorshipId(aggregate, generateMentorshipOpaqueId());
}

/**
 * Derives the correlation id paired with a public id. Deterministic so the
 * same public id groups its retries and events under the same key.
 */
export function deriveCorrelationId(publicId: string): string {
  return `corr_${hashToBase36(publicId)}`;
}

/** Validates a public id against the glossary shape for its aggregate. */
export function isStablePublicId(
  aggregate: MentorshipAggregate,
  value: string,
): boolean {
  return isMentorshipId(aggregate, value);
}
