"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { LibrarianNav, type LibrarianPermission } from "./LibrarianNav";

export interface LibrarianLayoutProps {
  children: React.ReactNode;
  permissions: LibrarianPermission[];
  activeHref: string;
  title: string;
  className?: string;
}

export function LibrarianLayout({
  children,
  permissions,
  activeHref,
  title,
  className,
}: LibrarianLayoutProps) {
  return (
    <div className={cn("min-h-screen bg-background", className)}>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 md:flex-row">
        <aside className="w-full shrink-0 md:w-56">
          <h2 className="mb-4 text-lg font-semibold">Library staff</h2>
          <LibrarianNav permissions={permissions} activeHref={activeHref} />
        </aside>
        <main className="flex-1 min-w-0">
          <h1 className="mb-6 text-2xl font-bold">{title}</h1>
          {children}
        </main>
      </div>
    </div>
  );
}
