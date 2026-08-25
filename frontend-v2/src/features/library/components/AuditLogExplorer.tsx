"use client";

import { useState } from "react";

export interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  resource: string;
  date: string;
  requestId: string;
  outcome: "success" | "failure";
}

interface AuditLogExplorerProps {
  entries: AuditLogEntry[];
  isLoading?: boolean;
  error?: string | null;
}

const redact = (value: string) => (value.length > 4 ? `${value.slice(0, 4)}***` : "***");

export function AuditLogExplorer({ entries, isLoading, error }: AuditLogExplorerProps) {
  const [actorFilter, setActorFilter] = useState("");

  if (isLoading) return <p role="status">Loading audit log…</p>;
  if (error) return <p role="alert">{error}</p>;

  const filtered = entries.filter((entry) =>
    entry.actor.toLowerCase().includes(actorFilter.toLowerCase())
  );

  if (filtered.length === 0) return <p>No audit entries found.</p>;

  return (
    <div>
      <input
        aria-label="Filter by actor"
        value={actorFilter}
        onChange={(e) => setActorFilter(e.target.value)}
        placeholder="Filter by actor"
      />
      <ul>
        {filtered.map((entry) => (
          <li key={entry.id}>
            {entry.date} — {redact(entry.actor)} {entry.action} {entry.resource} (
            {entry.outcome}, req: {redact(entry.requestId)})
          </li>
        ))}
      </ul>
    </div>
  );
}
