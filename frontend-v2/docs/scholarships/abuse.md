# Rate & abuse controls

Closes #1150. Source: `src/features/scholarships/abuse/`.
Route: `/scholarships/abuse`.

## What this is

Per-surface, per-risk-tier request limits with explicit retry guidance, a bypass
that requires a service authorization id, and a hard guarantee that a throttled
request never damages a saved draft.

Six `AbuseSurface` values — `public-discovery`, `application-submit`,
`document-upload`, `invitation`, `messaging`, `payout-action` — each with a
`RateLimitPolicy` per `RiskTier` (`low`, `standard`, `elevated`, `high`):
`limit`, `windowSeconds`, and `burstAllowance`. `limitForSurface` returns the
exact policy or, failing that, the closest **lower** tier, so an untiered caller
is never given more headroom than a tier below it. Nothing here is random and
every function takes its clock as an argument, so a window rollover is asserted
exactly rather than slept through.

`evaluateRateLimit(state, now)` returns a `RateLimitDecision`:

- A **closed window is rolled over first**, so a caller that returns after the
  window gets its budget back instead of a stale denial.
- **Allowed** — the guidance names how many requests remain.
- **Denied** — `retryAfterSeconds` is set and the guidance spells out
  `Retry after N second(s) (Retry-After: N)`, then states the consequence: the
  request was not applied and the saved draft is unchanged. A denial is a
  rejection, never a partial application.

**Bypass.** `requestBypass(decision, serviceAuthorizationId)` grants nothing
without an explicit, non-blank service authorization id. An allowed request is
returned unchanged — there is no "retry harder" path that disables a limit, and
a granted bypass names the authorization in its guidance because the grant is
recorded.

**Draft integrity.** `isDraftIntact(draft, payload)` compares a submitted payload
against the last save with a canonicalised, key-sorted serialisation, so it is
unaffected by key order. The panel keeps a live indicator of whether the payload
about to be sent is exactly what the last save holds, and offers *Discard local
edits and reload the last save*. This is the point of the module: **a limited
request must never corrupt or truncate a saved draft.** The limit protects the
endpoint; it must not cost the applicant their work.

## Ownership

- **Code owner:** platform/frontend foundation team
  (`src/features/scholarships/abuse/**`).
- **Policy owner:** trust and safety sets the limits per surface and tier;
  finance operations owns `payout-action`, which is the surface where a mistake
  is expensive. Bursts are an abuse-team decision, not a UX one.
- **Bypass authority:** a service authorization id is issued by the service
  owner. A human acting in the UI cannot mint one, which is the point.
- **Roles:** available to `administrator` and to the non-admin `finance` role.
  A reader without the grant can still see the meter and the guidance; only the
  bypass request is disabled, with a `role="note"` naming who to ask.

## Privacy

- Rate-limit state is keyed by a pseudonymous subject id, not by an email or a
  wallet address. The client never stores a raw identity next to a counter.
- The risk tier is an abuse signal, not a judgement about a person. It must not
  be rendered to a student or used in an admissions decision, and logging must
  not join a tier to an application.
- Bypass records carry the service authorization id and a justification. They are
  audit evidence, so they are retained under the `audit` retention class
  (see `retention.md`) and are never deleted with the subject's own records.
- A draft payload can contain an application essay. The integrity check compares
  payloads in memory and reports only a boolean and a field count — it must never
  log the payload itself.

## Migration

- Additive only. `DEFAULT_ABUSE_POLICIES` is a client-side reference used when
  the policy endpoint is unavailable; the API remains authoritative and the
  panel reads `GET /scholarships/abuse/policies` on load.
- Rollout order: publish policies server-side, confirm the client is reading
  them, then tighten. A limit that appears before the policy exists would deny
  traffic against an unknown budget, so the client fails toward "no policy
  configured" and says so rather than guessing.
- Existing clients that do not send an idempotency key are unaffected; the
  module does not require one, it only verifies that a saved draft is intact.
- To relax a limit, raise `limit` for the tier rather than adding a bypass —
  bypasses are for one-off authorised exceptions, not for capacity.

## Operational impact

- `application-submit` at the `high` tier allows 2 requests per hour. A false
  positive there blocks a real applicant, so tier assignment errors are
  user-impacting: watch the denial rate by tier and alert on a denial rate that
  jumps for `low` or `standard` specifically.
- Retry guidance is part of the contract with clients. A `429` without a usable
  `Retry-After` produces a retry storm; the panel always states the number.
- Metrics to watch: denial rate by surface and tier, bypass grants by
  authorization id, and window rollover volume. A bypass grant on a surface with
  no denials is a mistake and should be reported.
- Alerts: sustained denials on `payout-action` are operational-impacting on the
  finance side; page.
- Cost: one counter read and one attempt write per guarded request. Rate limiting
  is the most write-amplified control here — size the store accordingly.

## Verify

- `npx vitest run src/features/scholarships/__tests__/abuse.test.ts
  src/features/scholarships/abuse` — limit enforcement with retry guidance,
  reset after the window, bypass denied without authorization, and a draft that
  is never corrupted, plus the component's loading / empty / error / permission
  states and ARIA wiring.
- `npx tsc --noEmit` — no errors in `src/features/scholarships/abuse/`.
- Route smoke: open `/scholarships/abuse`, select `application-submit` at
  `standard`, and confirm the meter reads 0 of 10.
- Denial smoke: press *Simulate request* until the meter is full and confirm the
  status region names the retry seconds; press *Request bypass* with an empty
  authorization and confirm it stays denied with the field marked invalid.
- Draft smoke: type into the unsaved-note field and confirm the integrity
  indicator reports local edits pending and offers a reload.
