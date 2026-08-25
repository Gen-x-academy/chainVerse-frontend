/**
 * Minimal feature-flag + telemetry helper for the E-Library rollout.
 * Flags fail safe (default off) and telemetry never includes book
 * content or patron-identifying data — only event names and IDs.
 */

export type ElibraryFlag =
  | 'elibrary_reader_v2'
  | 'elibrary_wallet_payments'
  | 'elibrary_circulation_desk';

const DEFAULT_FLAGS: Record<ElibraryFlag, boolean> = {
  elibrary_reader_v2: false,
  elibrary_wallet_payments: false,
  elibrary_circulation_desk: false,
};

export function isElibraryFlagEnabled(flag: ElibraryFlag): boolean {
  try {
    const raw = process.env[`NEXT_PUBLIC_FLAG_${flag.toUpperCase()}`];
    if (raw === undefined) return DEFAULT_FLAGS[flag];
    return raw === 'true';
  } catch {
    // Fail safe: never let a flag-read error enable a feature.
    return false;
  }
}

interface ElibraryTelemetryEvent {
  name: string;
  correlationId: string;
  metadata?: Record<string, string | number | boolean>;
}

export function trackElibraryEvent(event: ElibraryTelemetryEvent): void {
  // Book content and patron PII must never be passed as metadata here.
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('elibrary-telemetry', { detail: event }));
}
