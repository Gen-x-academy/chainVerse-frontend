"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

export interface TutorLoanItem {
  id: string;
  title: string;
  status: "on-loan" | "reserved" | "on-hold" | "overdue";
  dueDate?: string;
  courseLinked: boolean;
}

export interface TutorBorrowingDashboardProps {
  items: TutorLoanItem[];
  isLoading?: boolean;
  onRenew?: (id: string) => void;
  className?: string;
}

export function TutorBorrowingDashboard({
  items,
  isLoading = false,
  onRenew,
  className,
}: TutorBorrowingDashboardProps) {
  const [scope, setScope] = useState<"personal" | "course">("personal");
  const visible = items.filter((i) =>
    scope === "course" ? i.courseLinked : !i.courseLinked
  );

  if (isLoading) return <p className="text-sm text-gray-500">Loading loans…</p>;

  return (
    <div className={cn("rounded-xl border border-gray-200 p-4", className)}>
      <div className="flex gap-2 mb-3">
        {(["personal", "course"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={cn(
              "text-xs px-3 py-1 rounded-full border",
              scope === s ? "bg-gray-900 text-white" : "text-gray-600"
            )}
          >
            {s === "personal" ? "My loans" : "Course-linked"}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-gray-400">No items in this view.</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((item) => (
            <li key={item.id} className="flex items-center justify-between text-sm">
              <span>
                {item.title}{" "}
                <span className="text-xs text-gray-400">({item.status})</span>
              </span>
              {onRenew && item.status !== "overdue" && (
                <button
                  onClick={() => onRenew(item.id)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Renew
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
