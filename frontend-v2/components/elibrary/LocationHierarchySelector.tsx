"use client";

import React, { useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { LocationBreadcrumb } from "./LocationBreadcrumb";
import type { LocationNode, LocationSelection } from "@/src/features/library/types/library.types";

export interface LocationHierarchySelectorProps {
  nodes: LocationNode[];
  selection: LocationSelection;
  onChange: (selection: LocationSelection) => void;
  isLoading?: boolean;
  error?: string | null;
  disabled?: boolean;
  className?: string;
}

function childrenOf(nodes: LocationNode[], parentId?: string): LocationNode[] {
  if (!parentId) return nodes.filter((n) => n.level === "branch");
  const parent = findInTree(nodes, parentId);
  return parent?.children ?? [];
}

function findInTree(nodes: LocationNode[], id: string): LocationNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findInTree(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

const LEVELS = [
  { key: "branchId" as const, label: "Branch", level: "branch" as const },
  { key: "roomId" as const, label: "Room", level: "room" as const },
  { key: "shelfId" as const, label: "Shelf", level: "shelf" as const },
  { key: "binId" as const, label: "Bin", level: "bin" as const },
];

/** #933: Cascading branch → room → shelf → bin selectors with safe dependent resets. */
export function LocationHierarchySelector({
  nodes,
  selection,
  onChange,
  isLoading,
  error,
  disabled,
  className,
}: LocationHierarchySelectorProps) {
  const handleChange = useCallback(
    (key: keyof LocationSelection, value: string) => {
      const next: LocationSelection = { ...selection, [key]: value || undefined };
      // Reset dependent choices when a parent changes
      if (key === "branchId") {
        next.roomId = undefined;
        next.shelfId = undefined;
        next.binId = undefined;
      } else if (key === "roomId") {
        next.shelfId = undefined;
        next.binId = undefined;
      } else if (key === "shelfId") {
        next.binId = undefined;
      }
      onChange(next);
    },
    [selection, onChange]
  );

  const optionsByLevel = useMemo(() => {
    return {
      branchId: childrenOf(nodes, undefined),
      roomId: selection.branchId ? childrenOf(nodes, selection.branchId) : [],
      shelfId: selection.roomId ? childrenOf(nodes, selection.roomId) : [],
      binId: selection.shelfId ? childrenOf(nodes, selection.shelfId) : [],
    };
  }, [nodes, selection.branchId, selection.roomId, selection.shelfId]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2" role="status" aria-label="Loading locations">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 rounded border bg-muted" />
        ))}
        <span className="sr-only">Loading locations...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        No locations configured.
      </p>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <LocationBreadcrumb nodes={nodes} selection={selection} />

      <div className="grid gap-3 sm:grid-cols-2">
        {LEVELS.map(({ key, label }) => {
          const options = optionsByLevel[key];
          const parentKey = LEVELS[LEVELS.findIndex((l) => l.key === key) - 1]?.key;
          const parentSelected = !parentKey || Boolean(selection[parentKey]);

          return (
            <label key={key} className="text-sm block">
              {label}
              <select
                aria-label={`Select ${label.toLowerCase()}`}
                className="mt-1 w-full rounded border px-3 py-2"
                value={selection[key] ?? ""}
                onChange={(e) => handleChange(key, e.target.value)}
                disabled={disabled || !parentSelected}
              >
                <option value="">— Select {label.toLowerCase()} —</option>
                {options.map((opt) => (
                  <option key={opt.id} value={opt.id} disabled={!opt.active}>
                    {opt.label}
                    {!opt.active ? " (inactive)" : ""}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
    </div>
  );
}
