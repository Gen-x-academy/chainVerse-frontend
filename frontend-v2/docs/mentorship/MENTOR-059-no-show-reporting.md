# MENTOR-059: Handle no-show reporting

Issue: #1306. Track: Scheduling. Repository: `chainVerse-frontend` (`frontend-v2`).

## Scope

A participant reports that the mentor, the mentee, both, or a technical problem
stopped a session. The other participant is told and can respond. A coordinator
decides. No consequence is applied automatically unless the program policy says
so, and then only to an uncontested report after the response deadline.

- `src/features/mentorship/sessions/no-show-reports.ts` is the pure logic:
  `createNoShowReport`, `respondToNoShowReport`, `resolveNoShowReport`,
  `applyDueConsequences`, `dueProcessSatisfied` and `redactNoShowReportFor`.
- `no-show-reports.service.ts` is the typed API client and analytics.
- `components/NoShowReportForm.tsx` is the reporter's form.
- `components/NoShowCasePanel.tsx` shows a report to the accused and to
  coordinators, with the response form and the resolution form.
- `components/EvidenceEditor.tsx` is the shared, bounded evidence control.
- `session-core.ts` gains the report types, error codes and events.

## Who can report, and when

- Reports require a booked session: a cancelled session is refused with
  `SESSION_NOT_BOOKED`. A completed session is accepted, because that is when
  most no-shows are reported.
- Only the session's mentor or mentee can report. A mentee can report the
  mentor, both, or a technical problem. A mentor can report the mentee, both,
  or a technical problem. Nobody reports their own absence. Coordinators
  resolve reports; they do not file them.
- Reporting opens `opensAfterMinutes` after the scheduled start, so a late
  arrival is not reported as an absence, and closes `reportWindowHours` after
  the scheduled end. Both boundaries are inclusive. Outside the window the
  errors are `NO_SHOW_TOO_EARLY` and `NO_SHOW_WINDOW_CLOSED`, and the form
  says when reporting opens.

## Limited evidence

Evidence is bounded and held by reference, following the conduct report
module. A report carries a statement of 5 to 1000 characters and at most
`maxEvidenceItems` items, three by default. An item is either:

- a **note**: plain text of up to 500 characters, with no markup; or
- an **attachment**: an opaque reference to a file stored elsewhere, with a
  declared type from an allowlist (PNG, JPEG, PDF) and a size under 5 MB.

The logic rebuilds every item field by field, so unknown properties, URLs and
markup never reach a report. The editor checks type and size before uploading,
and the upload itself is a separate API that returns the reference.

## One report per session, and duplicates merge

There is one report per session. Its id is derived from the session, so any
order of events leads to the same report.

- If the other participant already opened it, the new claim merges into it and
  the original response deadline stands. Merging never extends or resets it.
- Two claims that agree, for example both reporting that neither attended,
  stay a single uncontested report. Claims that differ mark it
  `conflicting`, and a conflicting report is never resolved automatically.
- A repeat by the same person, with the same key or a new one, is a replay: no
  second claim, no second event. A different claim by the same person returns
  `NO_SHOW_ALREADY_REPORTED`. The same key with different details returns
  `IDEMPOTENCY_KEY_REUSED`.
- Each distinct claim, response and resolution produces exactly one event, and
  the event id includes the report and the person, so two claims never collide.
- A resolved report refuses new claims.

## Due process for the accused

- The accused participant is notified by the `no_show_reported` event and sees
  the claim, the statement and any notes in the case panel. The panel states
  until when they can respond and that nothing is decided against them before
  then.
- They can respond with a statement and the same bounded evidence. An
  identical repeat is a replay. A different second response is refused so the
  record stays stable. They can still respond after the deadline, until the
  report is resolved.
- A coordinator cannot rule against a participant until that participant has
  responded or the deadline has passed (`DUE_PROCESS_PENDING`). This applies
  to `uphold_mentor_no_show`, `uphold_mentee_no_show` and `uphold_both_absent`.
  Outcomes that harm nobody, `dismiss` and `technical_issue`, are allowed at
  any time. A person who filed their own claim has been heard through it, so a
  conflicting report can be decided at once. A technical report has no accused.
- The resolution form disables the adverse outcomes until due process is
  satisfied and explains why, and the server enforces the same rule.

## Consequences wait for policy

Opening a report changes nothing: the session stays as it is, nothing is sent
to settlement, and the report shows the consequence `pending_policy`.

- A coordinator or administrator resolves the report with one of five
  outcomes. `uphold_mentor_no_show` leads to a mentee refund,
  `uphold_mentee_no_show` to mentor compensation, and the other three to no
  financial consequence. The resolution is recorded on the report and emitted
  as one `no_show_resolved` event. Settlement acts on that event.
- `applyDueConsequences` can resolve an uncontested report without a
  coordinator, but only when `autoConsequences` is on, which it is not by
  default. Even then it acts only on a report with a single mentor or mentee
  claim, no conflict, no response, and a response deadline that has passed.
  The system is recorded as the resolver. It is idempotent.

## Restricted evidence and confidentiality

- A report is visible only to the session's participants and to coordinators
  and administrators of the tenant. Other tenants and other people in the
  tenant see nothing, and an unknown id looks the same as a forbidden one.
- Coordinators see everything. A participant sees every statement and note,
  so the accused can answer fairly, but attachment references are restricted
  to the person who supplied them. Everyone else sees only that an attachment
  exists. `redactNoShowReportFor` does this and the API must apply it before
  returning data. It never changes the stored report.
- Events and analytics never carry statements, notes, evidence or the
  resolution note. They carry ids, the report type and the outcome category.
- Analytics uses an opaque actor key and counts each new fact once.

## Authorisation

Deny by default. Reporting and responding need the mentor or mentee of the
session in the same tenant. Resolving needs a coordinator or administrator of
the tenant. Anything else, including an unknown session or report id, returns
`NOT_AUTHORIZED`.

## Errors

| Code | Status |
| --- | --- |
| `NO_SHOW_TOO_EARLY` | 409 |
| `NO_SHOW_WINDOW_CLOSED` | 409 |
| `NO_SHOW_ALREADY_REPORTED` | 409 |
| `NO_SHOW_ALREADY_RESPONDED` | 409 |
| `NO_SHOW_ALREADY_RESOLVED` | 409 |
| `DUE_PROCESS_PENDING` | 409 |

They join the shared table from MENTOR-056 and carry messages that name the
next step and never contain personal data.

## Dependencies

- **Backend/API** must implement:
  - `POST /mentorship/sessions/{sessionId}/no-show-reports` with
    `Idempotency-Key`
  - `POST /mentorship/no-show-reports/{reportId}/responses`
  - `POST /mentorship/no-show-reports/{reportId}/resolution`
  and apply the same checks transactionally, redact responses per viewer, and
  emit each event once.
- **Evidence storage** must provide an upload endpoint that validates type and
  size, stores the file privately and returns the opaque reference, and must
  authorise reads by the same rules as `redactNoShowReportFor`.
- **Notifications** consume the three events to tell the accused, the reporter
  and coordinators.
- **Settlement** (MENTOR-083 and the payments services) acts only on
  `no_show_resolved`, never on a report being opened.
- **Safety** (MENTOR-086) conduct reports remain the route for conduct
  concerns. A no-show report is not a conduct report.
- **Mobile** must use the same window, due process and restriction rules.
- Corresponding MENTOR-059 work: the backend, smart-contract and mobile
  repositories each carry an item with the same identifier in the Scheduling
  track. This repository implements only the frontend part.

## Rollout

1. Deploy the endpoints and the private evidence store behind a flag with the
   policy per program. Leave `autoConsequences` off.
2. Verify in staging the window boundaries, both participants reporting at the
   same moment, a conflicting pair, an accused who responds late, a ruling
   before the deadline and evidence reads by each role.
3. Enable reporting first, then responses, then coordinator resolution.
4. Review the first cohort of reports by hand before considering
   `autoConsequences`, and enable it per program, not globally.
5. Monitor `NO_SHOW_TOO_EARLY`, `DUE_PROCESS_PENDING`, the share of
   conflicting reports and the time to resolution.

## Tests

- `no-show-reports.test.ts` covers reporting rules and the window boundaries,
  evidence limits and normalisation, idempotency, merging in both orders,
  conflicts, responses, the due process gate, every outcome and consequence,
  the policy gate for automatic consequences, and attachment restriction for
  each viewer.
- `no-show-reports.service.test.ts` covers the endpoints, the header and the
  analytics rules.
- `__tests__/NoShowReportForm.test.tsx`, `NoShowCasePanel.test.tsx` cover every
  state, validation, evidence and uploads, the accused's view and response, the
  coordinator's disabled outcomes, retry key reuse, duplicate submit protection
  and keyboard only completion.
