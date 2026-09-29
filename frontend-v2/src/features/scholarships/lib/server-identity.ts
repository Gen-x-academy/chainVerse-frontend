/**
 * Server-assigned identity for scholarship awards (issue #1223).
 *
 * The browser is allowed to generate exactly two kinds of value, and the
 * distinction is load-bearing:
 *
 * 1. **Retry tokens** — the `clientToken` / `Idempotency-Key` a form attaches to
 *    a mutation. These *must* exist before the server responds, otherwise a
 *    retry after a dropped connection double-applies the write. They carry no
 *    authority: the server uses them to key its idempotency store and never
 *    surfaces one as a record identifier.
 * 2. **Render keys** — the `key` React needs for a row the server has not
 *    identified yet. These are prefixed `pending:` so a render key can never be
 *    mistaken for, or persisted as, a record ID.
 *
 * What the client may never do is mint a *persistent* identifier: an award ID, a
 * decision ID, an agreement ID, or a cancellation record ID. Those are assigned
 * by the API. `assertServerAssignedId` turns that rule into something a test can
 * assert, and `attachServerIdentity` performs the deterministic swap from a
 * render key to the server's identifier.
 *
 * Why it matters: a client-generated `decision-${Date.now()}` looks like a real
 * record, collides across tabs that render in the same millisecond, and — worse —
 * survives in a persisted store, where a later read presents it as if the server
 * had issued it.
 */

/** Render keys are namespaced so they can never be confused with a record ID. */
export const PENDING_IDENTIFIER_PREFIX = 'pending:';

/**
 * Retry tokens are a safe, client-generated nonce. They are *not* identifiers:
 * never display one, persist one as an ID, or accept one as a resource key.
 */
export type IdempotencyScope =
  | 'award.create'
  | 'award.accept'
  | 'award.decline'
  | 'award.cancel'
  | 'award.terminate'
  | 'award.decision';

const SCOPES: readonly IdempotencyScope[] = [
  'award.create',
  'award.accept',
  'award.decline',
  'award.cancel',
  'award.terminate',
  'award.decision',
];

/** Raised when a value that must be server-assigned is missing or looks minted. */
export class UnverifiedServerIdentifierError extends Error {
  readonly code = 'IDENTIFIER_NOT_SERVER_ASSIGNED' as const;

  constructor(context: string, received: unknown) {
    super(
      `${context} must be assigned by the scholarship API, received ${JSON.stringify(received)}. ` +
        'The client must not substitute its own identifier.',
    );
    this.name = 'UnverifiedServerIdentifierError';
  }
}

export function isIdempotencyScope(value: string): value is IdempotencyScope {
  return (SCOPES as readonly string[]).includes(value);
}

/**
 * Cryptographically random nonce for one user action. `Math.random()` and
 * `Date.now()` are deliberately not used: both are guessable, which is exactly
 * what a retry token must not be — a guessable token lets one caller replay
 * another caller's mutation.
 */
function randomNonce(): string {
  const webCrypto = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : undefined;

  if (webCrypto && typeof webCrypto.randomUUID === 'function') {
    return webCrypto.randomUUID();
  }

  if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
    const bytes = webCrypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  // Every environment this app targets (modern browsers, Node 18+) exposes Web
  // Crypto. Reach this only on a stripped-down runtime, where a guessable nonce
  // is still preferable to a hard failure mid-submit.
  console.warn(
    'Web Crypto is unavailable; falling back to a low-entropy retry token. Retry tokens stay safe to generate client-side, but never treat them as identifiers.',
  );
  let fallback = '';
  for (let index = 0; index < 4; index += 1) {
    fallback += Math.floor(Math.random() * 0xffffffff).toString(36);
  }
  return `low-entropy-${fallback}`;
}

/**
 * Builds the `clientToken` for a single user action. It is stable for the life
 * of that action so a retry reuses it, and callers mint a new one only when the
 * user starts a genuinely new action.
 */
export function createIdempotencyToken(scope: IdempotencyScope): string {
  if (!isIdempotencyScope(scope)) {
    throw new Error(`Unknown idempotency scope "${scope}".`);
  }
  return `${scope}:${randomNonce()}`;
}

/**
 * React key for an entity the server has not identified yet. The `pending:`
 * prefix makes the value self-describing so it is never written to storage or
 * rendered as an ID.
 */
export function createRenderKey(scope: IdempotencyScope): string {
  return `${PENDING_IDENTIFIER_PREFIX}${createIdempotencyToken(scope)}`;
}

export function isRenderKey(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(PENDING_IDENTIFIER_PREFIX);
}

/** True only for values that could plausibly have been issued by the API. */
export function isServerAssignedId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && !isRenderKey(value);
}

/**
 * Guards a value that must come from the API. Rejects render keys, blanks, and
 * non-strings so a mis-mapped response cannot silently become a record ID.
 */
export function assertServerAssignedId(value: unknown, context: string): string {
  if (!isServerAssignedId(value)) {
    throw new UnverifiedServerIdentifierError(context, value);
  }
  return value;
}

export type PendingEntity<T> = T & {
  id: string;
  /** False while `id` is still a render key. */
  persisted: boolean;
};

/**
 * Wraps an optimistic entity so React can render it before the API responds.
 * The wrapper is explicit: `persisted: false` means the `id` is a render key.
 */
export function createPendingEntity<T extends object>(
  scope: IdempotencyScope,
  draft: T,
): PendingEntity<T> {
  return { ...draft, id: createRenderKey(scope), persisted: false };
}

/**
 * Deterministically swaps a pending entity for the server's record: the render
 * key is replaced by the API-assigned ID and the entity is marked persisted, so
 * a later render cannot resurrect the optimistic identifier.
 */
export function attachServerIdentity<T extends { id: string }>(
  _pending: PendingEntity<T>,
  recorded: T,
): T & { persisted: true } {
  const id = assertServerAssignedId(recorded.id, 'Server-assigned record identifier');
  return { ...recorded, id, persisted: true };
}

export const serverIdentity = {
  createIdempotencyToken,
  createRenderKey,
  isRenderKey,
  isServerAssignedId,
  assertServerAssignedId,
  createPendingEntity,
  attachServerIdentity,
};
