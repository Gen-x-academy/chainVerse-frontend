# ADR-001: Scholarship Platform Boundaries and Invariants

- Status: Accepted
- Deciders: E-Library & Finance product group, frontend foundation team
- Date: 2026-09-24
- Code owner: `@Gen-x-academy/chainVerse-frontend`
- Audited against: `Gen-x-academy/chainVerse-frontend` `origin/main` commit `c01b242cd0c4eb6894fce9138f31918e2163b6ac`

## Context

ChainVerse Academy is introducing a first-class scholarship, sponsorship, and
bursary experience. The frontend must represent five distinct actors that each
hold different responsibilities and data boundaries:

- **Student** — searches open rounds and applies; may hold multiple applications
  only across *different* rounds.
- **Sponsor** — funds rounds/programs and views anonymized award outcomes; never
  sees individual application essays, scores, or financial-aid details.
- **Reviewer** — evaluates applications against rubric; sees no payment or
  disbursement account details.
- **Finance** — approves awards and executes disbursements; sees financial data
  but not reviewer notes.
- **Administrator** — configures programs, rounds, roles, and review periods.

This ADR defines the boundaries and invariants the frontend expects the
scholarship API to honour, so the UI can be built once, role-scoped, without a
second, divergent data model.

## Decision

1. **Single feature module.** All scholarship UI lives in
   `src/features/scholarships`, exposed publicly through
   `src/features/scholarships/index.ts`. Cross-feature imports must use that
   entrypoint only (see `docs/feature-boundaries.md`).
2. **Canonical route hierarchy.** Every scholarship route lives under
   `/scholarships`. Route access is decided by a role map in
   `utils/scholarshipRoles.ts` and enforced uniformly by
   `ScholarshipPageShell`. Any actor without access receives the same
   "Access denied" state — no per-route copy.
3. **Typed contract.** The feature consumes a typed API contract
   (`ScholarshipProgram`, `ScholarshipRound`, `ScholarshipApplication`,
   `ScholarshipAward`, `ScholarshipDisbursement`). Roles never cast to
   untyped payloads.
4. **Privacy by default.** Financial fields (`amountCents`, funding pools),
   reviewer attribution, and application essays are rendered only by the
   role that owns them. Students never see reviewer identities; sponsors never
   see student financial-aid answers.

## State machines

### Application lifecycle

```
draft -> submitted -> under_review -> shortlisted -> approved -> (award) -> disbursed
                          \-> rejected            \-> rejected
draft -> withdrawn (any time before shortlisting)
```

- `submitted` is the only status a student can push from the client.
- `under_review` and `shortlisted` are reviewer transitions.
- `approved` is a finance/administrator transition.
- A rejected or withdrawn application cannot be resubmitted; the student must
  start a new application in a new round.

### Round lifecycle

```
draft -> open -> review -> closed -> archived
                \-> cancelled
```

- Applications may only be created/submitted while the round is `open`.
- `closed` stops all new applications and starts award processing.

### Award and disbursement lifecycle

```
pending -> accepted -> disbursed
        \-> declined -> cancelled
```

- A disbursement is `scheduled -> processing -> completed | failed`.
- `failed` disbursements never retry automatically; finance re-queues.

## Invariants

1. A student can hold **at most one submitted application per round**.
2. Application amounts are compared against the round's
   `awardAmountCents` **and** the program owner's remaining
   `fundingPoolCents`.
3. No award may exceed the approved application amount.
4. Disbursement totals per award, across successes and retries, must never
   exceed the award `amountCents` (idempotency key on disbursement creation).
5. Review scores are write-once: a submitted score may be replaced only via an
   auditing event, never edited in place.
6. Financial amounts are always transmitted as integer minor units
   (`*Cents`) with an explicit `currency`; the client never divides or mixes
   currencies.
7. Reviewer users must not be a participant (student or sponsor) on the same
   round — this conflict is resolved server-side.
8. All application and award writes must be idempotent by `clientToken` to
   survive network retries.

## Failure modes

| Failure | Detected by | Frontend behaviour |
| --- | --- | --- |
| Deadline race during submit | 409 with round status | Inline error; reload round status state |
| Duplicate submit | 409 duplicate-application | Inline error; point student to existing application |
| Insufficient funding pool | 422 funding-shortfall | Warn on application preview; block award creation |
| Reviewer conflict of interest | 403 conflict | Consistent access-denied state |
| Disbursement double-send | 409 idempotency | Show existing disbursement; never re-authorise |
| Partial ledger failure | 502/partial result | Isolate panel error; keep other tabs usable |
| Unauthorised actor | 401/403 | Consistent error + redirect to login when session is missing |

## Privacy boundaries

- Student → own application, own award, own disbursement receipts.
- Sponsor → program funding activity and anonymised engagement metrics.
- Reviewer → application essays + scores for assigned rounds only.
- Finance → applications, awards, disbursements; no reviewer free-text notes.
- Administrator → all of the above via explicit grants; no relationship of
  trust upgrade beyond approved belonging to the platform team.

## Explicit non-goals

- No direct peer-to-peer sponsorship between private individuals in v1.
- No on-chain disbursement execution or token-gated scholarships in v1; the
  disbursement model is representation-only until the on-chain contract lands.
- No scholarship marketplace or bidding between sponsors and students.
- No automatic eligibility scoring by the frontend; scoring is a backend
  concern and reaches the UI only as a status.

## Consequences

- Route guard logic is centralized (`ScholarshipPageShell` + role map), so a
  new area needs one permission entry and one page.
- Backend must expose the five typed endpoints the service layer targets
  (`/scholarships/programs`, `/rounds`, `/applications`, `/awards`,
  `/disbursements`) and enforce invariants 1–8 server-side; the client treats
  violations as errors and isolates them per panel.
- Migration is purely additive: no existing route, module, or store is
  replaced, so the scholarship module can ship behind its own routes without a
  data migration.