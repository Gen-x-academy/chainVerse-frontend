# MENTOR-112 — Mentorship abuse threat model

Closes #1359. Work item: **MENTOR-112** (Trust & Safety track).
Source: `src/features/mentorship/**`. Route: `/mentorship`.

## Overview

**Scope.** The mentorship threat surface spans the browser, `frontend-v2`, the
backend API, the email and calendar providers the API calls, and the payment
smart contracts behind escrow. This document models abuse of *people and data*,
not just endpoints: a malicious mentor, a malicious mentee, a tenant
administrator exceeding their remit, a stolen session, and an attacker abusing
an integration. Mitigations are stated as frontend controls where the frontend
is authoritative (presentation, preconditions, UX denial states) and as
backend/provider/contract controls where it is not. The frontend never claims to
be the enforcement point; every client guard is re-enforced server-side (see
[MENTOR-003](./MENTOR-003-role-permission-matrix.md)).

**Assets.** Mentor and mentee profiles (including government ID and payout
account references held by the backend), applications and agreements, session
records, payment intents and escrow state, calendar links and availability,
in-app messages, minors' data and guardian consent, and audit events.

**Trust boundaries.**

1. **Browser ↔ frontend-v2.** All client state is untrusted. A decision rendered
   in the UI is advisory; the API re-checks.
2. **frontend-v2 ↔ backend API.** The only authority for tenant, role, owner,
   and state transitions. `POST /mentorship/access/check` mirrors the client
   matrix but must not be the sole gate.
3. **Backend API ↔ providers (email / calendar).** Calendar invites and email
   carry data out of the platform; over-sharing here is a leak even when the API
   is correct.
4. **Backend API ↔ smart contracts.** Escrow release, refund, and settlement are
   contract actions; the frontend only requests them and mirrors state.
5. **Tenant boundaries.** A sponsor organization, guardian household, or the
   platform is a tenant. Cross-tenant reads and writes are always denied
   (`CROSS_TENANT_DENIED`), including for `administrator`.

## Attacker paths

- **Malicious mentor** grooms a mentee, pushes sessions off-platform, or
  manipulates deliverables/payments to extract value without delivery.
- **Malicious mentee** files false disputes, seeks refunds after receiving
  sessions, or harasses a mentor through messaging.
- **Tenant administrator abuse.** An admin with full CRUD on their tenant
  attempts to read another tenant's records, self-approve their own records, or
  exfiltrate a minor's data via export.
- **Token theft.** A stolen session or refresh token is replayed to act as
  another principal; tenant scoping must not depend on a client-supplied id.
- **Enumeration.** Sequential or guessable identifiers are probed to confirm the
  existence of profiles, programs, or applications across tenants.
- **Calendar invite leakage.** A meeting invite exposes a personal email,
  recovery address, or timezone to the other party, or leaks the existence of a
  session to an uninvited third party.
- **Phishing via in-app messaging.** A message impersonates support or billing
  to move a user to a credential-harvesting page.

## Privacy threats and mitigations

| ID | Threat | Mitigation | Owner |
| --- | --- | --- | --- |
| MT-P-01 | Cross-tenant profile read via guessed id | Tenant compare before every grant; deny-by-default matrix | backend/security |
| MT-P-02 | Direct identifier leakage (email, wallet, national id) in responses | Field-level shaping per role; identifiers never in list payloads | backend/privacy |
| MT-P-03 | Enumeration of resources by sequential ids | Opaque identifiers and 404-not-403 on cross-tenant probe | backend/security |
| MT-P-04 | Minor's data exposed to unrelated staff | Ward-scoped guardian reads; least-privilege staff roles | privacy/trust-and-safety |
| MT-P-05 | Over-broad export includes restricted fields | Export requires explicit grant; identifier guard on payload | finance/privacy |
| MT-P-06 | Availability/timezone inferred by a counterparty | Timezone rendered as needed, never stored in the invite as a raw zone | frontend/backend |

## Payment risks and mitigations

| ID | Risk | Mitigation | Owner |
| --- | --- | --- | --- |
| MT-PAY-01 | Escrow manipulation: amount or recipient changed after agreement | Agreement hash pinned on-chain; client shows the contract terms verbatim | contracts team |
| MT-PAY-02 | Refund abuse: mentee claims non-delivery after sessions | Session + deliverable evidence required before refund; dispute record retained | finance/trust-and-safety |
| MT-PAY-03 | Self-settle by the author or approver | `SELF_APPROVAL_DENIED` for `approve`/`publish`/`settle`, including admin | backend/security |
| MT-PAY-04 | Replay of a settlement request | Idempotency key on every settlement; contract rejects a duplicate nonce | contracts team |
| MT-PAY-05 | Payment intent leaked to a non-owner tenant | Payment readable only inside the owning tenant and role | backend/privacy |

## Safety for minors

- **Guardian consent.** A mentee under the age of majority cannot enter an
  agreement before a linked guardian records consent; the consent record names
  the guardian and the scope they approve.
- **Messaging restrictions.** A minor's direct messages are limited to matched,
  guardian-approved mentors; off-platform contact details are filtered and the
  thread remains on-platform and auditable.
- **Content safety.** Reports of grooming, harassment, or self-harm route to the
  moderation queue and are never auto-resolved; a blocked user is excluded from
  matching (`blocked-user-matching`).
- **Data minimisation.** A guardian sees only the linked ward's records
  (`GUARDIAN_SCOPE_DENIED` otherwise), never the ward's private messages.

## Calendar integrations risks

- **Over-sharing.** The invite carries only the display name and the in-app
  meeting link; a personal email or recovery address must never be a calendar
  attendee.
- **Timezone leakage.** Availability is exchanged as opaque slots, not a raw
  zone or home location; a slot reveals only the agreed time.
- **Third-party visibility.** A calendar provider is a separate processor; the
  invite body must contain no case notes, payment amounts, or minor-identifying
  detail.

## Messaging risks

- **Phishing.** Support and billing never ask for credentials in-app; a message
  containing an external credential request is flagged and copy states it is not
  from ChainVerse.
- **Harassment.** Rate limits and block lists apply per sender; a blocked
  principal cannot open a new thread through matching.
- **Evidence integrity.** Messages are append-only for the audit class; an
  abuse report snapshots the thread so deletion does not erase evidence.
- **Leakage.** Message bodies are visible only to the two participants and,
  where a minor is involved, the linked guardian — never to unrelated staff.

## High risks and tracked controls

High risks are tracked with stable control IDs; a control that is not yet
implemented is listed with its owner and target, not omitted.

| Control | Risk | Status | Owner |
| --- | --- | --- | --- |
| MT-C-01 | Cross-tenant read/write | Implemented (rbac) + API re-check | backend/security |
| MT-C-02 | Self-approval of payments | Implemented (rbac) + contract rule | contracts team |
| MT-C-03 | Minor grooming via messaging | Partial — moderation queue + block list | trust-and-safety |
| MT-C-04 | Calendar invite over-sharing | Required — invite field allowlist | frontend/backend |
| MT-C-05 | Refund abuse | Implemented — evidence gate + dispute record | finance |
| MT-C-06 | Token replay | Required — short-lived tokens, rotation | backend/identity |

## Testable assumptions

Each assumption is written as a testable statement; a failing statement is a
defect, not a note.

1. A principal whose tenant differs from the resource tenant is denied for every
   action and every resource, including `administrator`.
2. A principal who owns a resource is denied `approve`, `publish`, and `settle`
   on that resource, even as `administrator`.
3. A guardian reading a `mentee-profile` outside their `wards` is denied.
4. A denial carries a stable reason enum and never echoes the resource body.
5. An under-age mentee cannot reach an agreement without recorded guardian
   consent.
6. A calendar invite generated by the platform contains no personal email,
   recovery address, payment amount, or raw timezone.
7. A blocked principal is excluded from matching and cannot open a new thread.
8. An export payload containing a direct identifier is rejected before it leaves
   the client.

## Review cadence

- **Quarterly** scheduled review of this document and the control table.
- **On feature launch** that touches mentorship data, payments, minors, calendar,
  or messaging — before rollout.
- **On incident** involving mentorship abuse, within five business days.
- Control owners confirm status at each review; a downgraded control reopens the
  associated risk.

## Ownership

| Area | Owner |
| --- | --- |
| Document | trust-and-safety (author), privacy (reviewer) |
| RBAC / tenant isolation | backend/security |
| Payments & escrow | finance + contracts team |
| Minors' safety | trust-and-safety |
| Calendar & messaging | frontend foundation + backend |
| Incident response | security on-call |

## Privacy boundaries

- No personal data lives in this document; it names asset classes and controls.
- The client holds presentation state only. Government ID, payout references, and
  reporter identity stay inside their owning roles (see
  [MENTOR-001](./MENTOR-001-bounded-contexts.md)).
- Abuse signals are about behaviour, not identity: a risk signal must not be
  rendered to a mentee or used to deny a benefit outside the reported incident.
- Audit records for abuse reports are retained under the `audit` retention class
  and are not deleted with the subject's own records.

## Rollout considerations

- Additive only: this document and the tenant-isolation suite add no runtime
  behaviour. The API remains authoritative throughout.
- Roll out in order: publish server-side checks, confirm the client reads them,
  then tighten. A client-only deny without a server rule is a UX state, not a
  control.
- Because the matrix is deny-by-default, shipping it changes no access until a
  surface reads it.
- Before a minors or calendar surface ships, MT-C-03 / MT-C-04 must be at least
  partial with a named owner.

## Cross-repo note

The corresponding **MENTOR-112** work lives alongside this document in the other
ChainVerse repositories: the **backend** owns the authoritative access check,
minors consent, messaging moderation, and calendar invite shaping; the
**contracts** repository owns escrow pinning, settlement idempotency, and the
self-approval rule; the **mobile** client mirrors the same controls. A change to
tenant scoping, denial reasons, or consent is a breaking change to this work
item.

## Verify

- `npx vitest run test/mentorship/tenant-isolation.test.ts` — same-tenant grants,
  cross-tenant denial across roles and resources, mutation denial, admin
  cross-tenant denial, and no resource body echoed on denial.
- `npx vitest run src/features/mentorship/__tests__/rbac.test.ts` — matrix,
  self-approval, and guardian scope.
- `npx tsc --noEmit`.
