"use client";

import { useState } from "react";

export type PatronNote = {
  id: string;
  body: string;
  visibility: "staff-only" | "sensitive";
  category: string;
  createdBy: string;
  createdAt: string;
};

// Staff-only note panel. Notes are never shown in patron-facing views.
export default function PatronNotePanel({
  notes,
  canViewSensitive,
  onAdd,
}: {
  notes: PatronNote[];
  canViewSensitive: boolean;
  onAdd: (body: string, category: string) => void;
}) {
  const [body, setBody] = useState("");
  const visible = notes.filter((n) => n.visibility !== "sensitive" || canViewSensitive);

  return (
    <div className="border rounded p-4 space-y-3">
      <h3 className="font-semibold">Patron Notes (Staff Only)</h3>
      {visible.length === 0 && <p className="text-sm text-gray-500">No notes yet.</p>}
      <ul className="space-y-2">
        {visible.map((n) => (
          <li key={n.id} className="text-sm border-b pb-1">
            <span className="font-medium">[{n.category}]</span> {n.body}
            <div className="text-xs text-gray-400">{n.createdBy} &middot; {n.createdAt}</div>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a note" className="border p-1 rounded flex-1" />
        <button
          onClick={() => { if (body.trim()) { onAdd(body, "general"); setBody(""); } }}
          className="px-3 py-1 border rounded bg-blue-500 text-white"
        >
          Add
        </button>
      </div>
    </div>
  );
}
