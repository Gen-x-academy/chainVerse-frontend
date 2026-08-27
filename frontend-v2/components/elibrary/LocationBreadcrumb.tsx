"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { LocationNode, LocationSelection } from "@/src/features/library/types/library.types";

export interface LocationBreadcrumbProps {
  nodes: LocationNode[];
  selection: LocationSelection;
  className?: string;
}

function findNode(nodes: LocationNode[], id: string): LocationNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

function buildPath(nodes: LocationNode[], selection: LocationSelection): LocationNode[] {
  const ids = [selection.branchId, selection.roomId, selection.shelfId, selection.binId].filter(Boolean) as string[];
  return ids.map((id) => findNode(nodes, id)).filter(Boolean) as LocationNode[];
}

/** #933: Readable location breadcrumb for forms and patron displays. */
export function LocationBreadcrumb({ nodes, selection, className }: LocationBreadcrumbProps) {
  const path = buildPath(nodes, selection);

  if (path.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)} role="status">
        No location selected
      </p>
    );
  }

  return (
    <nav aria-label="Location breadcrumb" className={cn("text-sm", className)}>
      <ol className="flex flex-wrap items-center gap-1">
        {path.map((node, i) => (
          <li key={node.id} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden className="text-muted-foreground">/</span>}
            <span
              className={cn(
                "rounded px-2 py-0.5",
                node.active ? "bg-muted" : "bg-destructive/10 text-destructive line-through"
              )}
            >
              {node.label}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
