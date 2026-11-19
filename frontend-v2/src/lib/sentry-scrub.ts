/**
 * Sentry event enrichment/scrubbing helper for issue #834.
 * Attaches release + environment metadata and strips PII, tokens, and
 * wallet data from outgoing events before they leave the client/server.
 *
 * Extended for CAPSTONE-067/069/077/078: workspace private notes, discussion
 * content, review comments, and revision change descriptions are redacted from
 * breadcrumbs, error contexts, and replay payloads before transmission.
 */
import type { Event, EventHint } from '@sentry/nextjs';

const SENSITIVE_KEYS = ['authorization', 'cookie', 'token', 'wallet', 'secret', 'password'];

/**
 * Keys whose values may carry private workspace content (notes, discussions,
 * review comments, revision change descriptions). Values are fully redacted.
 */
const PRIVATE_CONTENT_KEYS = [
  'note',
  'notes',
  'notebody',
  'body',
  'content',
  'message',
  'comment',
  'comments',
  'discussion',
  'thread',
  'reply',
  'mention',
  'attachment',
  'attachmentname',
  'changedescription',
  'changedescriptions',
  'change',
  'changes',
  'description',
  'rationale',
  'reviewcomment',
  'reviewcomments',
  'feedback',
  'revision',
  'revisions',
  'proposalbody',
  'researchbody',
  'private',
];

const REDACTED = '[Filtered]';

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEYS.some((s) => lower.includes(s));
}

function isPrivateContentKey(key: string): boolean {
  const lower = key.toLowerCase();
  return PRIVATE_CONTENT_KEYS.some((s) => lower.includes(s));
}

function shouldRedact(key: string): boolean {
  return isSensitiveKey(key) || isPrivateContentKey(key);
}

function scrubObject(value: Record<string, unknown>): Record<string, unknown> {
  const scrubbed: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    scrubbed[key] = shouldRedact(key) ? REDACTED : val;
  }
  return scrubbed;
}

/**
 * Recursively scrub nested structures (breadcrumb data, error contexts, replay
 * payloads) so private content cannot leak through nested objects or arrays.
 */
function scrubDeep(value: unknown, depth = 0): unknown {
  if (depth > 8) return REDACTED;
  if (Array.isArray(value)) {
    return value.map((item) => scrubDeep(item, depth + 1));
  }
  if (value && typeof value === 'object') {
    const scrubbed: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      scrubbed[key] = shouldRedact(key) ? REDACTED : scrubDeep(val, depth + 1);
    }
    return scrubbed;
  }
  return value;
}

function scrubBreadcrumbs(event: Event): void {
  if (!event.breadcrumbs) return;
  event.breadcrumbs = event.breadcrumbs.map((crumb) => {
    if (!crumb) return crumb;
    const next = { ...crumb };
    if (next.data) {
      next.data = scrubDeep(next.data) as Record<string, unknown>;
    }
    if (typeof next.message === 'string') {
      next.message = REDACTED;
    }
    return next;
  });
}

function scrubContexts(event: Event): void {
  if (!event.contexts) return;
  event.contexts = scrubDeep(event.contexts) as Event['contexts'];
}

function scrubException(event: Event): void {
  if (!event.exception?.values) return;
  event.exception.values = event.exception.values.map((value) => {
    if (!value) return value;
    const next = { ...value };
    if (next.value) {
      // Keep the error type but drop potentially private message bodies.
      next.value = REDACTED;
    }
    return next;
  });
}

function scrubReplay(event: Event): void {
  const replay = (event as Event & { replay?: unknown }).replay;
  if (replay) {
    (event as Event & { replay?: unknown }).replay = scrubDeep(replay);
  }
}

export function scrubSensitiveData(event: Event, _hint: EventHint): Event {
  if (event.request?.headers) {
    event.request.headers = scrubObject(event.request.headers as Record<string, unknown>);
  }
  if (event.request?.url) {
    event.request.url = event.request.url.split('?')[0];
  }
  if (event.request?.data) {
    event.request.data = scrubDeep(event.request.data);
  }
  if (event.extra) {
    event.extra = scrubDeep(event.extra) as Record<string, unknown>;
  }
  scrubBreadcrumbs(event);
  scrubContexts(event);
  scrubException(event);
  scrubReplay(event);
  return event;
}

export function releaseContext(release: string, environment: string) {
  return {
    release,
    environment,
    tracesSampleRate: environment === 'production' ? 0.1 : 1,
  };
}
</｜｜DSML｜｜ parameter>