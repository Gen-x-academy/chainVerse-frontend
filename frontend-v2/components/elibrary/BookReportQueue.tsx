"use client";

import { useState } from "react";

export type BookReport = {
  id: string;
  bookTitle: string;
  reason: string;
  status: "open" | "assigned" | "resolved" | "dismissed";
};

const STATUSES: BookReport["status"][] = ["open", "assigned", "resolved", "dismissed"];

// Librarian triage queue for patron-submitted catalog/content reports.
export default function BookReportQueue({
  reports,
  onStatusChange,
}: {
  reports: BookReport[];
  onStatusChange: (id: string, status: BookReport["status"]) => void;
}) {
  const [filter, setFilter] = useState<"all" | BookReport["status"]>("all");
  const visible = reports.filter((r) => filter === "all" || r.status === filter);

  return (
    <div className="border rounded p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Book Reports</h3>
        <select aria-label="Filter reports" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="border p-1 rounded">
          <option value="all">All</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {visible.length === 0 && <p className="text-sm text-gray-500">No reports.</p>}
      <ul className="space-y-2">
        {visible.map((r) => (
          <li key={r.id} className="text-sm border-b pb-2 flex items-center justify-between">
            <div>
              <div className="font-medium">{r.bookTitle}</div>
              <div className="text-xs text-gray-500">{r.reason}</div>
            </div>
            <select aria-label={`Status for ${r.bookTitle}`} value={r.status} onChange={(e) => onStatusChange(r.id, e.target.value as BookReport["status"])} className="border p-1 rounded text-xs">
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </li>
        ))}
      </ul>
    </div>
  );
}
