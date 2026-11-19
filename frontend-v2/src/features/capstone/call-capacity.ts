/**
 * Call capacity and waitlists (CAPSTONE-021).
 *
 * Tracks proposal slots, team seats, reserved offers, confirmed projects and an
 * ordered waitlist with expiry and deterministic promotion. All functions are
 * pure: they take the current state and return a new one plus the events that
 * happened, so retries with the same request id are idempotent and the same
 * inputs always give the same outcome.
 */

export interface Reservation {
  applicantId: string;
  /** ISO instant when the offer lapses. */
  expiresAt: string;
}

export interface CapacityState {
  /** Total seats in the call. */
  seats: number;
  confirmed: string[];
  reserved: Reservation[];
  /** Waitlist in join order. */
  waitlist: string[];
  /** Request ids already handled, for idempotency. */
  handled: string[];
}

export type CapacityEvent =
  | { type: "confirmed"; applicantId: string }
  | { type: "reserved"; applicantId: string; expiresAt: string }
  | { type: "waitlisted"; applicantId: string; position: number }
  | { type: "promoted"; applicantId: string; expiresAt: string }
  | { type: "expired"; applicantId: string }
  | { type: "released"; applicantId: string };

export type CapacityError = "ALREADY_PRESENT" | "NOT_FOUND" | "NO_SEAT" | "OFFER_EXPIRED" | "INVALID_SEATS";

export interface CapacityResult {
  ok: boolean;
  state: CapacityState;
  events: CapacityEvent[];
  error?: CapacityError;
  /** True when this request id had already been applied. */
  replayed?: boolean;
}

export function newCapacity(seats: number): CapacityState {
  if (!Number.isInteger(seats) || seats < 0) throw new RangeError("seats must be a non-negative integer");
  return { seats, confirmed: [], reserved: [], waitlist: [], handled: [] };
}

export const seatsTaken = (s: CapacityState): number => s.confirmed.length + s.reserved.length;
export const seatsFree = (s: CapacityState): number => Math.max(0, s.seats - seatsTaken(s));

const isPresent = (s: CapacityState, id: string) =>
  s.confirmed.includes(id) || s.reserved.some((r) => r.applicantId === id) || s.waitlist.includes(id);

/** Skip a request that was already applied; mark new ones as handled. */
function once(state: CapacityState, requestId: string, apply: () => CapacityResult): CapacityResult {
  if (state.handled.includes(requestId)) return { ok: true, state, events: [], replayed: true };
  const result = apply();
  return result.ok ? { ...result, state: { ...result.state, handled: [...result.state.handled, requestId].slice(-500) } } : result;
}

/**
 * Apply for a seat. With a free seat the applicant gets a reservation (an
 * offer to confirm before `expiresAt`); otherwise they join the waitlist.
 */
export function apply(state: CapacityState, requestId: string, applicantId: string, now: Date, offerHours = 48): CapacityResult {
  return once(state, requestId, () => {
    if (isPresent(state, applicantId)) return { ok: false, state, events: [], error: "ALREADY_PRESENT" };
    if (seatsFree(state) > 0) {
      const expiresAt = new Date(now.getTime() + offerHours * 3_600_000).toISOString();
      return { ok: true, state: { ...state, reserved: [...state.reserved, { applicantId, expiresAt }] }, events: [{ type: "reserved", applicantId, expiresAt }] };
    }
    const waitlist = [...state.waitlist, applicantId];
    return { ok: true, state: { ...state, waitlist }, events: [{ type: "waitlisted", applicantId, position: waitlist.length }] };
  });
}

/** Confirm a reserved seat before its offer lapses. */
export function confirm(state: CapacityState, requestId: string, applicantId: string, now: Date): CapacityResult {
  return once(state, requestId, () => {
    const offer = state.reserved.find((r) => r.applicantId === applicantId);
    if (!offer) return { ok: false, state, events: [], error: state.confirmed.includes(applicantId) ? "ALREADY_PRESENT" : "NOT_FOUND" };
    if (offer.expiresAt <= now.toISOString()) return { ok: false, state, events: [], error: "OFFER_EXPIRED" };
    return {
      ok: true,
      state: { ...state, reserved: state.reserved.filter((r) => r.applicantId !== applicantId), confirmed: [...state.confirmed, applicantId] },
      events: [{ type: "confirmed", applicantId }],
    };
  });
}

/** Promote waitlisted applicants into free seats, in order. */
function promote(state: CapacityState, now: Date, offerHours: number): { state: CapacityState; events: CapacityEvent[] } {
  let current = state;
  const events: CapacityEvent[] = [];
  while (seatsFree(current) > 0 && current.waitlist.length > 0) {
    const [next, ...rest] = current.waitlist;
    const expiresAt = new Date(now.getTime() + offerHours * 3_600_000).toISOString();
    current = { ...current, waitlist: rest, reserved: [...current.reserved, { applicantId: next, expiresAt }] };
    events.push({ type: "promoted", applicantId: next, expiresAt });
  }
  return { state: current, events };
}

/** Release a seat or waitlist spot (withdrawal) and promote the next applicant. */
export function release(state: CapacityState, requestId: string, applicantId: string, now: Date, offerHours = 48): CapacityResult {
  return once(state, requestId, () => {
    const wasHolder = state.confirmed.includes(applicantId) || state.reserved.some((r) => r.applicantId === applicantId);
    if (!wasHolder && !state.waitlist.includes(applicantId)) return { ok: false, state, events: [], error: "NOT_FOUND" };
    const trimmed: CapacityState = {
      ...state,
      confirmed: state.confirmed.filter((id) => id !== applicantId),
      reserved: state.reserved.filter((r) => r.applicantId !== applicantId),
      waitlist: state.waitlist.filter((id) => id !== applicantId),
    };
    const promoted = promote(trimmed, now, offerHours);
    return { ok: true, state: promoted.state, events: [{ type: "released", applicantId }, ...promoted.events] };
  });
}

/** Lapse expired offers and promote the waitlist. Safe to run repeatedly. */
export function expireOffers(state: CapacityState, now: Date, offerHours = 48): CapacityResult {
  const iso = now.toISOString();
  const lapsed = state.reserved.filter((r) => r.expiresAt <= iso);
  if (lapsed.length === 0) return { ok: true, state, events: [] };
  const trimmed: CapacityState = { ...state, reserved: state.reserved.filter((r) => r.expiresAt > iso) };
  const promoted = promote(trimmed, now, offerHours);
  return { ok: true, state: promoted.state, events: [...lapsed.map((r) => ({ type: "expired" as const, applicantId: r.applicantId })), ...promoted.events] };
}

/** Change the seat count. Shrinking never evicts holders; it only stops new offers. */
export function resize(state: CapacityState, seats: number, now: Date, offerHours = 48): CapacityResult {
  if (!Number.isInteger(seats) || seats < 0) return { ok: false, state, events: [], error: "INVALID_SEATS" };
  const promoted = promote({ ...state, seats }, now, offerHours);
  return { ok: true, state: promoted.state, events: promoted.events };
}
