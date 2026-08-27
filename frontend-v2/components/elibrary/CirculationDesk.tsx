"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarcodeScanInput } from "./BarcodeScanInput";
import type { CopyDetail, ScanMode } from "@/src/features/library/types/library.types";

export interface CirculationDeskProps {
  isLoading?: boolean;
  error?: string | null;
  mode: ScanMode;
  onModeChange: (mode: ScanMode) => void;
  copyDetail?: CopyDetail | null;
  copyLoading?: boolean;
  lastScanMessage?: string | null;
  onScan?: (barcode: string, mode: ScanMode) => Promise<{ success: boolean; duplicate?: boolean; error?: string }>;
  onManualLookup?: (query: string) => void;
  className?: string;
}

const MODES: { key: ScanMode; label: string }[] = [
  { key: "checkout", label: "Checkout" },
  { key: "return", label: "Return" },
  { key: "stocktake", label: "Stocktake" },
  { key: "copy-detail", label: "Copy detail" },
];

/** #932: Circulation desk combining scan modes and copy detail panel. */
export function CirculationDesk({
  isLoading,
  error,
  mode,
  onModeChange,
  copyDetail,
  copyLoading,
  lastScanMessage,
  onScan,
  onManualLookup,
  className,
}: CirculationDeskProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Circulation mode">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={mode === m.key}
            className={cn(
              "rounded-md px-3 py-2 text-sm",
              mode === m.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
            onClick={() => onModeChange(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="capitalize">{mode.replace("-", " ")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BarcodeScanInput
              mode={mode}
              isLoading={isLoading}
              error={error}
              lastScanMessage={lastScanMessage}
              onScan={onScan}
              onManualLookup={onManualLookup}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Copy detail</CardTitle>
          </CardHeader>
          <CardContent>
            {copyLoading && (
              <p role="status" className="text-sm text-muted-foreground">
                Loading copy details...
              </p>
            )}
            {!copyLoading && !copyDetail && (
              <p role="status" className="text-sm text-muted-foreground">
                Scan or look up a barcode to view copy details.
              </p>
            )}
            {copyDetail && (
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Title</dt>
                  <dd className="font-medium">{copyDetail.title}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Author</dt>
                  <dd>{copyDetail.author}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Barcode</dt>
                  <dd className="font-mono">{copyDetail.barcode}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="capitalize">{copyDetail.status.replace("-", " ")}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Location</dt>
                  <dd>{copyDetail.locationLabel}</dd>
                </div>
                {copyDetail.patronName && (
                  <div>
                    <dt className="text-muted-foreground">Checked out to</dt>
                    <dd>{copyDetail.patronName}</dd>
                  </div>
                )}
                {copyDetail.dueDate && (
                  <div>
                    <dt className="text-muted-foreground">Due date</dt>
                    <dd>{copyDetail.dueDate}</dd>
                  </div>
                )}
              </dl>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
