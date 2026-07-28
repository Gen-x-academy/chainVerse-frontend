/**
 * Sentry event enrichment/scrubbing helper for issue #834.
 * Attaches release + environment metadata and strips PII, tokens, and
 * wallet data from outgoing events before they leave the client/server.
 */
import type { Event, EventHint } from '@sentry/nextjs';

const SENSITIVE_KEYS = ['authorization', 'cookie', 'token', 'wallet', 'secret', 'password'];

function scrubObject(value: Record<string, unknown>): Record<string, unknown> {
  const scrubbed: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    scrubbed[key] = SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))
      ? '[Filtered]'
      : val;
  }
  return scrubbed;
}

export function scrubSensitiveData(event: Event, _hint: EventHint): Event {
  if (event.request?.headers) {
    event.request.headers = scrubObject(event.request.headers as Record<string, unknown>);
  }
  if (event.request?.url) {
    event.request.url = event.request.url.split('?')[0];
  }
  if (event.extra) {
    event.extra = scrubObject(event.extra);
  }
  return event;
}

export function releaseContext(release: string, environment: string) {
  return {
    release,
    environment,
    tracesSampleRate: environment === 'production' ? 0.1 : 1,
  };
}
