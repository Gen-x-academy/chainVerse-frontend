# Scholarships funnel metrics, sponsor impact and service-level indicators

## Overview

- **Funnel metrics** — program views, application starts, submissions, review completion, decisions, acceptance, milestones, and payment completion. Definitions are versioned (`FUNNEL_DEFINITIONS_VERSION`), events are deduplicated on a stable key, the snapshot exposes its data freshness (`dataThrough`), and private fields are rejected before an event is accepted (`issue #1158`).
- **Sponsor impact reporting** — recipients, funded learning, completion, credentials, and aggregate outcomes. Groups smaller than `SMALL_GROUP_THRESHOLD` are suppressed and sponsors cannot drill into an individual student's data (`issue #1159`).
- **Operational service-level indicators** — latency, errors, queue age, notification lag, payment finalization, and reconciliation drift, each with an explicit target and comparison direction plus a burn rate (`issue #1160`).

The surface lives at `/scholarships/analytics`.

## Ownership

Platform engineering owns the SLI definitions, dashboards, and alerts. The Student Access team owns
funnel definitions, and the sponsor relations team owns impact reporting narratives.

## Privacy

Analytics events carry an **opaque `actorKey`**, never a user id, email, or name; `assertNoPrivateFields`
rejects payloads containing private fields before ingestion. Impact metrics are suppressed for small
groups so an individual learner cannot be inferred, and correlation ids are sanitized — anything
resembling a credential is replaced with `redacted`.

## Migration

Funnel definitions are versioned rather than edited in place: changing a stage's meaning requires a
new `FUNNEL_DEFINITIONS_VERSION`, and snapshots record the version they were computed with so
historical dashboards remain comparable. Impact reports record the same definitions version.

## Operational impact

- **Data freshness** is visible on every snapshot; a stale `dataThrough` means the funnel should not be trusted yet.
- **Deduplication** means a retried event is counted once, so retries never inflate conversion.
- **SLI targets** drive alerts: `breach` means the worst sample in the window exceeded the target (or fell below it for `min` indicators).
- **Small groups** report `null` metrics rather than an approximated figure, and `notes` explains why.
- **Reconciliation drift** has a target of zero, so any unreconciled payment intent is a breach.

## Troubleshooting

| Symptom | Likely cause | Action |
| --- | --- | --- |
| Funnel counts look low | `dataThrough` is stale | Wait for ingestion, then re-query |
| Same event counted twice | Dedupe key changes per retry | Derive `dedupeKey` from the fact, not the attempt |
| Impact metrics all `null` | Group below `SMALL_GROUP_THRESHOLD` | Widen the reporting scope |
| Sponsor cannot open a learner profile | Expected — drill-down is denied for sponsors | Use an authorized support/reviewer role |
| SLI shows `no-data` | No samples in the window | Confirm the exporter is sampling |
