"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_ADMIN_CONFIG,
  previewAdminConfigChange,
  redactAdminConfig,
  validateAdminConfig,
  type ScholarshipAdminConfig,
} from "../admin-config";
import { buildScholarshipEvent, dedupeScholarshipEvents } from "../events";
import {
  mapLegacyAidRecord,
  runLegacyMigration,
  type LegacyFinancialAidRecord,
} from "../migration";
import {
  reconcileAllSettlements,
  type LedgerTransaction,
  type SettlementIntent,
} from "../settlement";
import { ScholarshipLoadTestPanel } from "./ScholarshipLoadTestPanel";

const sampleIntents: SettlementIntent[] = [
  {
    id: "intent-1001",
    awardId: "award-88",
    amount: "250.00",
    asset: "XLM",
    destination: "GDESTINATIONAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    status: "submitted",
    txHash: "tx-hash-001",
  },
  {
    id: "intent-1002",
    awardId: "award-89",
    amount: "400.00",
    asset: "USDC",
    destination: "GOTHERDESTINATIONBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    status: "submitted",
    txHash: "tx-hash-002",
  },
];

const sampleTransactions: LedgerTransaction[] = [
  {
    hash: "tx-hash-001",
    successful: true,
    ledger: 1020,
    memo: "intent-1001",
    amount: "250.00",
    asset: "XLM",
    destination: "GDESTINATIONAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  },
  {
    hash: "tx-hash-002",
    successful: true,
    ledger: 1023,
    memo: "intent-1002",
    amount: "420.00",
    asset: "USDC",
    destination: "GOTHERDESTINATIONBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
  },
];

const sampleLegacyRecords: LegacyFinancialAidRecord[] = [
  {
    legacyId: "aid-2019-001",
    applicantId: "student-44",
    programName: "Legacy bursary",
    requestedAmount: 300,
    currency: "USD",
    status: "approved",
    submittedAt: "2019-04-02T10:00:00.000Z",
    reviewerNote: "retained as an unmapped field",
  },
  {
    legacyId: "aid-2019-002",
    applicantId: "student-51",
    programName: "Legacy bursary",
    requestedAmount: 120,
    currency: "USD",
    status: "rejected",
    submittedAt: "2019-05-11T08:30:00.000Z",
  },
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      <div className="mt-4 space-y-2 text-sm text-slate-700">{children}</div>
    </section>
  );
}

export function ScholarshipOperationsPanel() {
  const [config, setConfig] =
    useState<ScholarshipAdminConfig>(DEFAULT_ADMIN_CONFIG);

  const settlement = useMemo(
    () => reconcileAllSettlements(sampleIntents, sampleTransactions, 1025),
    [],
  );

  const migration = useMemo(
    () =>
      runLegacyMigration(sampleLegacyRecords, {
        scholarshipId: "scholarship-standard",
        dryRun: true,
      }),
    [],
  );

  const events = useMemo(
    () =>
      dedupeScholarshipEvents([
        buildScholarshipEvent({
          name: "scholarship.application.submitted",
          aggregateId: "application-1",
          correlationId: "corr-1",
          producer: "scholarships-ui",
          idempotencyKey: "submit-application-1",
          occurredAt: "2026-09-24T10:00:00.000Z",
        }),
        buildScholarshipEvent({
          name: "scholarship.application.submitted",
          aggregateId: "application-1",
          correlationId: "corr-1",
          producer: "scholarships-ui",
          idempotencyKey: "submit-application-1",
          occurredAt: "2026-09-24T10:00:05.000Z",
        }),
      ]),
    [],
  );

  const preview = useMemo(
    () =>
      previewAdminConfigChange(DEFAULT_ADMIN_CONFIG, {
        ...config,
        maxApplicationsPerApplicant: config.maxApplicationsPerApplicant + 1,
      }),
    [config],
  );

  const configErrors = validateAdminConfig(config);
  const mappedExample = mapLegacyAidRecord(
    sampleLegacyRecords[0],
    "scholarship-standard",
  );

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 text-slate-900">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Scholarships operations
        </p>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          Integration, migration &amp; administration
        </h1>
        <p className="max-w-2xl text-sm text-slate-600 md:text-base">
          Durable domain events, on-chain settlement reconciliation, resumable
          legacy migration, and validated administration configuration in one
          operator surface.
        </p>
      </header>

      <ScholarshipLoadTestPanel />

      <Section
        title="Domain events outbox"
        description="Events carry a schema version, correlation id and a stable dedupe key."
      >
        <p role="status" aria-live="polite">
          {events.length} unique event{events.length === 1 ? "" : "s"} after
          deduplication.
        </p>
        <ul
          className="list-disc pl-5"
          aria-label="Recent scholarship domain events"
        >
          {events.map((event) => (
            <li key={event.eventId}>
              {event.name} · v{event.version} · {event.correlationId}
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Settlement reconciliation"
        description="Reconciled status is derived from final ledger transactions only."
      >
        <ul
          className="space-y-2"
          aria-label="Settlement reconciliation results"
        >
          {settlement.map((item) => (
            <li
              key={item.intentId}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3"
            >
              <span className="font-medium">{item.intentId}</span> —{" "}
              {item.reconciledStatus}
              {item.mismatches.length > 0 && (
                <span className="text-amber-700">
                  {" "}
                  ({item.mismatches.join(", ")})
                </span>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Legacy financial-aid migration (dry run)"
        description="Dry runs are resumable and report anything that could not be mapped."
      >
        <p>
          Would migrate {migration.migratedLegacyIds.length} record(s) and skip{" "}
          {migration.skippedLegacyIds.length} rejected record(s).
        </p>
        <p>
          Unmapped fields on legacy id {mappedExample.legacyId}:{" "}
          {mappedExample.unmappedFields.join(", ") || "none"}
        </p>
      </Section>

      <Section
        title="Administration configuration"
        description="Changes are previewed, validated, and secrets are returned as references only."
      >
        <p aria-live="polite">
          {configErrors.length === 0
            ? "Configuration is valid."
            : `Blocked: ${configErrors.join(" ")}`}
        </p>
        <p>Pending change(s): {preview.length}</p>
        <p className="break-all font-mono text-xs text-slate-500">
          webhook secret ref:{" "}
          {redactAdminConfig(config).webhookSigningSecretRef}
        </p>
        <button
          type="button"
          onClick={() =>
            setConfig((current) => ({
              ...current,
              maxAwardAmount: current.maxAwardAmount + 500,
            }))
          }
          className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Preview a limit increase
        </button>
      </Section>
    </section>
  );
}

export default ScholarshipOperationsPanel;
