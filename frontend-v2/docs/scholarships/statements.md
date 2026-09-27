# Sponsor financial statements (`closes #1131`)

## What this is

A sponsor-facing period statement at `/scholarships/statements`. A statement is
a **view of the ledger**, not a second source of truth: every `StatementLine`
carries the `ledgerEntryId` it came from, and `reconcileStatement` reports any
line that cannot be traced, is referenced twice, or disagrees on amount or
currency.

Exports have two paths, chosen by `ASYNCHRONOUS_EXPORT_THRESHOLD = 500`:

- **≤ 500 lines** — generated inline, ready to download immediately.
- **> 500 lines** — queued as a `StatementExportJob`; the UI says "queued — you'll
  be notified" and the job is polled (`queued → processing → ready → expired`)
  until the download expires.

## Ownership

- **Code owner:** the platform/frontend foundation team
  (`src/features/scholarships/statements/**`).
- **Access:** the owning sponsor, plus finance and administrators. The
  `canExport` prop is a UX guard only; the API enforces the same grant.
- **Data ownership:** sponsor account plus the Academy finance group.

## Privacy

- A statement is sponsor-scoped: it covers that sponsor's programs only. Export
  jobs are keyed to a `sponsorId` and must not be listable across sponsors.
- Amounts stay in integer minor units and the currency repeats on every CSV row,
  so a re-sorted or split file is never ambiguous. Currencies are never mixed
  into one statement.
- Reviewer identities and application essays never appear on a statement.

## Migration

- Additive only; the module reads `/scholarships/statements*` and adds no
  redirects.
- The CSV column set is `line_id, kind, occurred_at, description,
  amount_minor_units, currency, program_id, ledger_entry_id`. Consumers that
  assume major units or an amount-only column must be updated at the same time.

## Operational impact

- Statement generation is O(lines) in memory; the async threshold exists so a
  large period cannot pin a request thread. Watch export job failure rate and
  time-to-ready.
- Download links expire (`STATEMENT_EXPORT_TTL_MS`); the UI shows the expiry
  rather than handing back a dead link.
- A reconciliation discrepancy is shown as an alert, and a mixed-currency
  statement is refused with an explanation.

## Verify

```bash
npx vitest run src/features/scholarships/__tests__/statements.test.ts \
  src/features/scholarships/statements
npx tsc --noEmit 2>&1 | grep -E "src/features/scholarships/statements/"  # expect nothing
```

Route smoke: `/scholarships/statements` — a small period downloads directly, a
period over 500 lines reports a queued job, and dropping a ledger entry renders
a discrepancy.
