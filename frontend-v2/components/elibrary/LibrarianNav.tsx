"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type LibrarianPermission =
  | "catalog"
  | "circulation"
  | "patrons"
  | "acquisitions"
  | "reports"
  | "configuration"
  | "audits";

const NAV_ITEMS: { key: LibrarianPermission; label: string; href: string }[] = [
  { key: "catalog", label: "Catalog", href: "/library/catalog" },
  { key: "circulation", label: "Circulation", href: "/library/circulation" },
  { key: "patrons", label: "Patrons", href: "/library/patrons" },
  { key: "acquisitions", label: "Acquisitions", href: "/library/acquisitions" },
  { key: "reports", label: "Reports", href: "/library/reports" },
  { key: "configuration", label: "Configuration", href: "/library/configuration" },
  { key: "audits", label: "Audits", href: "/library/audits" },
];

export interface LibrarianNavProps {
  permissions: LibrarianPermission[];
  activeHref?: string;
  className?: string;
}

/**
 * Renders only the sections the librarian has permission for.
 * Callers are responsible for guarding the routes themselves and
 * clearing cached data when `permissions` shrinks (e.g. role change).
 */
export function LibrarianNav({ permissions, activeHref, className }: LibrarianNavProps) {
  const visible = NAV_ITEMS.filter((item) => permissions.includes(item.key));

  if (visible.length === 0) {
    return <p className="text-sm text-gray-400">No library sections available.</p>;
  }

  return (
    <nav className={cn("flex flex-col gap-1", className)}>
      {visible.map((item) => (
        <a
          key={item.key}
          href={item.href}
          className={cn(
            "text-sm px-3 py-2 rounded-md",
            activeHref === item.href
              ? "bg-gray-900 text-white"
              : "text-gray-700 hover:bg-gray-100"
          )}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
