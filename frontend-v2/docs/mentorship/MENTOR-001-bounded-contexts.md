# MENTOR-001 — Bounded contexts and shared vocabulary

Closes #1248. Source: `src/features/mentorship/glossary.ts`.
Shared work item: **MENTOR-001** (Foundation track). Version: `1.0.0`.

## What this is

One versioned glossary, one lifecycle per aggregate, and one invariant list, so
every mentorship surface — profile, taxonomy, engagement, session, deliverable,
payment, dispute — uses the same words and the same legal transitions. UI logic
and tests read from the same table; nothing re-declares a state list locally.

## Aggregates and ownership

| Aggregate | Owner team | Authoring role | Id prefix | Restricted fields |
| --- | --- | --- | --- | --- |
| mentor | identity-platform | mentor | `mtr` | `governmentId`, `verificationEvidenceRef` |
| mentee | identity-platform | mentee | `mte` | `accessibilityNeeds`, `matchingPreferences` |
| program | mentorship-operations | organization-staff | `prg` | `internalBudgetCents` |
| engagement | mentorship-operations | organization-staff | `eng` | `internalNotes` |
| session | mentorship-operations | mentor | `ses` | `privateRecordingRef` |
| deliverable | mentorship-operations | mentee | `dlv` | — |
| payment | finance | finance | `pay` | `payoutAccountRef` |
| dispute | trust-and-safety | moderator | `dsp` | `reporterIdentity` |

Identifiers are opaque (`<prefix>_<value>`) and are never derived from a name,
email, or index. `isMentorshipId` is the only shape check; the server owns
uniqueness.

## Lifecycles

Each aggregate has an explicit transition table. Re-entering the same state is a
no-op; every other pair is rejected with `ILLEGAL_TRANSITION`, and a state
outside the table is rejected with `UNKNOWN_STATE`. A terminal state has no
outgoing edges.

```
mentor      applicant -> verified -> active -> suspended -> active
                                            \-> retired (terminal)
program     draft -> published -> enrolling -> active -> completed -> archived
engagement  proposed -> accepted -> active -> completed
                                \-> cancelled | disputed -> active|cancelled|completed
session     scheduled -> confirmed -> in-progress -> completed
                                    \-> no-show (terminal) | cancelled (terminal)
deliverable draft -> submitted -> accepted (terminal)
                            \-> revision-requested -> submitted
payment     quoted -> authorized -> captured -> settled (terminal)
                                \-> voided    \-> refunded (terminal)
dispute     opened -> under-review -> resolved (terminal)
                            \-> escalated -> resolved
```

`MENTORSHIP_HAPPY_PATH` is the canonical end-to-end example and is asserted to
be fully legal by `happyPathIsValid()`.

## Invariants

1. A session requires an accepted or active engagement.
2. A mentor and mentee are distinct principals on every session.
3. A payment is authorized only against an **accepted** engagement.
4. An engagement completes only when every required deliverable is accepted.
5. A payment cannot settle while a dispute is open.

`validateMentorshipInvariants` evaluates whichever of these the caller has data
for and returns stable violation ids (`MENTOR-001-0n`).

## Privacy boundaries

Restricted fields never cross the surface that owns them: `governmentId` and
`payoutAccountRef` are references, not values, elsewhere in the app. See each
aggregate's row above and the MENTOR-011 identity-verification design for
verification.

## Rollout

Additive and inert: shipping the vocabulary changes no user-visible behaviour.
`mentorshipGlossaryService.get` fetches a remote copy and silently degrades to
the bundled version on failure, so a backend that has not shipped
`/mentorship/glossary` keeps working.

## Dependencies on other repositories

- **Contracts** (MENTOR-001) own the same identifiers and states; this module is
  the frontend projection.
- **Backend** exposes `GET /mentorship/glossary` returning `{ version, terms }`.
- **Mobile** mirrors the tables; `MENTORSHIP_VOCABULARY_VERSION` is the handshake.

## Verify

- `npx vitest run src/features/mentorship/__tests__/glossary.test.ts` —
  alias uniqueness, identifier round-trips, transition accept/reject, terminal
  states, and invariants.
- `npx tsc --noEmit`.
