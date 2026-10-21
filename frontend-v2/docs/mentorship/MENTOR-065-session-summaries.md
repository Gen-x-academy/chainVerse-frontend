# MENTOR-065 shared session summaries

## Scope

The frontend-v2 flow at `/mentorship/sessions` and
`/mentorship/sessions/{sessionId}/summary` lets session participants create,
edit, and explicitly confirm a shared summary containing concise notes,
decisions, resources, and next steps. Draft metadata includes its original
author, last editor, revision, and timestamps. Drafts remain visibly marked
unconfirmed until the API confirms them.

## API dependencies

- `GET /mentorship/sessions?status=completed` returns only completed sessions
  visible to the authenticated participant, with `sessionId`, `startsAt`,
  `counterpartName`, and `summaryState` (`missing`, `draft`, or `confirmed`).
- `GET /mentorship/sessions/{sessionId}/summary` authorizes a session
  participant and returns session participant ids and the current summary.
- `PUT /mentorship/sessions/{sessionId}/summary/draft` accepts only
  `expectedRevision`, `summaryText`, `decisions`, sanitized `resources`, and
  `nextSteps`. Derive actor identity from the authenticated principal; do not
  accept client-supplied authorship or private notes.
- `POST /mentorship/sessions/{sessionId}/summary/confirm` accepts
  `expectedRevision`. Enforce participant authorization and atomically confirm
  only that revision.
- Save and confirmation endpoints must scope and persist `Idempotency-Key`
  per authenticated principal. Replays return the original result and must not
  create another revision, confirmation, or notification. Reject a reused key
  with a different request body as a conflict.
- Return stable `403`, `404`, and `409` outcomes for denied, unavailable, and
  stale-revision requests. Enforce all authorization on the server; frontend
  role and participant checks are presentation safeguards only.

## Privacy and safety boundaries

- Private notes are deliberately absent from the UI, request types, and API
  payload allowlist. Never merge private notes into shared-summary data.
- The server is authoritative for authorship, editor, revisions, confirmation,
  participant relationships, and timestamps.
- Only HTTP(S) resource links without embedded credentials are saved/rendered;
  rendered external links use `noopener noreferrer`.
- Analytics records separate draft and confirmation stages with the session
  entity id and a non-personal fixed actor key. Do not add names, emails, note
  content, URLs, or authenticated user ids to analytics events.
- Summary reads and edits should follow the platform retention, export, and
  erasure rules for session records. Do not cache summary bodies across users.

## Rollout

The API and frontend must ship behind the mentorship-session capability flag.
Keep reads participant-scoped and writes disabled until the backend enforces
the response and idempotency contracts above. Monitor stable `403`, `409`, and
service-unavailable rates without logging content. Roll back by disabling the
session-summary navigation/flag; preserve existing session and payment flows.

## Cross-repository coordination

- **ChainVerse backend, MENTOR-065:** implement participant-scoped list/read,
  draft upsert with revision conflict checks, explicit confirmation, stable
  errors, and principal-scoped idempotency.
- **ChainVerse contracts, MENTOR-065:** define the shared summary state,
  revision/confirmation event semantics, and whether confirmation is an
  evidence input to session completion or payment settlement. Do not put
  summary prose or resource URLs on-chain.
- **ChainVerse mobile, MENTOR-065:** mirror participant navigation, draft and
  confirmation states, link sanitization, private-notes boundary, and API
  idempotency contract.

Frontend validation: component tests cover accessible authoring, link
sanitization, confirmation, and authorization; the Playwright flow uses fixed
synthetic participants and mocks the API at desktop and mobile viewports.
