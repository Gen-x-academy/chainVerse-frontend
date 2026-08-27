"use client";

import React, { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarcodeScanInput } from "./BarcodeScanInput";
import { LocationHierarchySelector } from "./LocationHierarchySelector";
import type {
  LocationNode,
  LocationSelection,
  StocktakeDiscrepancy,
  StocktakeExpectedItem,
  StocktakeScannedItem,
  StocktakeSession,
} from "@/src/features/library/types/library.types";

export type StocktakeStep = "location" | "scan" | "review" | "closed";

const STORAGE_PREFIX = "elibrary-stocktake-session:";

export interface StocktakeSessionProps {
  nodes: LocationNode[];
  session: StocktakeSession | null;
  isLoading?: boolean;
  error?: string | null;
  locationsLoading?: boolean;
  locationsError?: string | null;
  onStartSession?: (location: LocationSelection, locationLabel: string) => Promise<{ success: boolean; session?: StocktakeSession; error?: string }>;
  onScan?: (barcode: string) => Promise<{ success: boolean; duplicate?: boolean; error?: string; item?: StocktakeScannedItem }>;
  onComplete?: () => Promise<{ success: boolean; error?: string }>;
  className?: string;
}

function locationLabelFromNodes(nodes: LocationNode[], selection: LocationSelection): string {
  const ids = [selection.branchId, selection.roomId, selection.shelfId, selection.binId].filter(Boolean) as string[];
  const labels: string[] = [];
  for (const id of ids) {
    const find = (list: LocationNode[]): string | undefined => {
      for (const n of list) {
        if (n.id === id) return n.label;
        if (n.children) {
          const c = find(n.children);
          if (c) return c;
        }
      }
      return undefined;
    };
    const label = find(nodes);
    if (label) labels.push(label);
  }
  return labels.join(" / ");
}

function persistSession(session: StocktakeSession) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${session.id}`, JSON.stringify(session));
    localStorage.setItem(`${STORAGE_PREFIX}active`, session.id);
  } catch {
    /* ignore quota errors */
  }
}

export function loadPersistedStocktakeSession(): StocktakeSession | null {
  if (typeof window === "undefined") return null;
  try {
    const activeId = localStorage.getItem(`${STORAGE_PREFIX}active`);
    if (!activeId) return null;
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${activeId}`);
    return raw ? (JSON.parse(raw) as StocktakeSession) : null;
  } catch {
    return null;
  }
}

/** #934: Guided stocktake with scan feedback, discrepancy review, and persisted progress. */
export function StocktakeSessionView({
  nodes,
  session,
  isLoading,
  error,
  locationsLoading,
  locationsError,
  onStartSession,
  onScan,
  onComplete,
  className,
}: StocktakeSessionProps) {
  const [step, setStep] = useState<StocktakeStep>(session ? "scan" : "location");
  const [selection, setSelection] = useState<LocationSelection>(session?.location ?? {});
  const [localSession, setLocalSession] = useState<StocktakeSession | null>(session);
  const [starting, setStarting] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      setLocalSession(session);
      setStep(session.status === "closed" ? "closed" : session.status === "review" ? "review" : "scan");
      persistSession(session);
    }
  }, [session]);

  const expectedCount = localSession?.expectedItems.length ?? 0;
  const foundCount = localSession?.scannedItems.filter((i) => i.status === "found").length ?? 0;
  const discrepancies: StocktakeDiscrepancy[] = localSession?.discrepancies ?? [];

  const handleStart = useCallback(async () => {
    if (!onStartSession || !selection.branchId) return;
    setStarting(true);
    const label = locationLabelFromNodes(nodes, selection);
    try {
      const result = await onStartSession(selection, label);
      if (result.success && result.session) {
        setLocalSession(result.session);
        persistSession(result.session);
        setStep("scan");
      }
    } finally {
      setStarting(false);
    }
  }, [onStartSession, selection, nodes]);

  const handleScan = useCallback(
    async (barcode: string) => {
      if (!onScan || !localSession) {
        return { success: false, error: "No active session" };
      }
      const result = await onScan(barcode);
      if (result.success && result.item) {
        setLocalSession((prev) => {
          if (!prev) return prev;
          const scannedItems = [...prev.scannedItems.filter((s) => s.barcode !== barcode), result.item!];
          const expectedBarcodes = new Set(prev.expectedItems.map((e) => e.barcode));
          const scannedBarcodes = new Set(scannedItems.map((s) => s.barcode));
          const discrepancies: StocktakeDiscrepancy[] = [
            ...prev.expectedItems
              .filter((e) => !scannedBarcodes.has(e.barcode))
              .map((e) => ({ barcode: e.barcode, title: e.title, type: "missing" as const })),
            ...scannedItems
              .filter((s) => s.status === "unexpected")
              .map((s) => ({ barcode: s.barcode, title: s.title, type: "unexpected" as const })),
          ];
          const next: StocktakeSession = {
            ...prev,
            scannedItems,
            discrepancies,
            status: discrepancies.length > 0 ? "review" : prev.status,
          };
          persistSession(next);
          return next;
        });
        setScanFeedback(`Found: ${result.item.title}`);
      }
      return result;
    },
    [onScan, localSession]
  );

  const handleComplete = useCallback(async () => {
    if (discrepancies.length > 0 && !reviewAcknowledged) {
      setCompleteError("Review all discrepancies before closing the session.");
      return;
    }
    if (!onComplete) return;
    setCompleting(true);
    setCompleteError(null);
    try {
      const result = await onComplete();
      if (result.success) {
        setStep("closed");
        if (localSession) {
          const closed = { ...localSession, status: "closed" as const };
          persistSession(closed);
          setLocalSession(closed);
        }
      } else {
        setCompleteError(result.error ?? "Failed to close session.");
      }
    } finally {
      setCompleting(false);
    }
  }, [onComplete, discrepancies.length, reviewAcknowledged, localSession]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3" role="status" aria-label="Loading stocktake">
        <div className="h-8 w-64 rounded bg-muted" />
        <div className="h-40 rounded border bg-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        {error}
      </div>
    );
  }

  if (step === "closed") {
    return (
      <Card className={className} role="status">
        <CardHeader>
          <CardTitle>Stocktake session closed</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>{localSession?.locationLabel}</p>
          <p>
            Scanned {foundCount} of {expectedCount} expected items.
          </p>
          {discrepancies.length > 0 && (
            <p>{discrepancies.length} discrepancies were reviewed and recorded.</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap gap-2 text-xs">
        {(["location", "scan", "review"] as StocktakeStep[]).map((s) => (
          <span
            key={s}
            className={cn(
              "rounded-full px-3 py-1 capitalize",
              step === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            {s}
          </span>
        ))}
      </div>

      {step === "location" && (
        <Card>
          <CardHeader>
            <CardTitle>Select stocktake location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <LocationHierarchySelector
              nodes={nodes}
              selection={selection}
              onChange={setSelection}
              isLoading={locationsLoading}
              error={locationsError}
            />
            <Button onClick={handleStart} disabled={!selection.branchId || starting}>
              {starting ? "Starting..." : "Start stocktake session"}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "scan" && localSession && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Scan expected copies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{localSession.locationLabel}</p>
              <p role="status" aria-live="polite" className="text-sm font-medium">
                Progress: {foundCount} / {expectedCount} found
              </p>
              <BarcodeScanInput mode="stocktake" onScan={handleScan} lastScanMessage={scanFeedback} />
              <Button variant="outline" onClick={() => setStep("review")}>
                Review discrepancies
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Expected items</CardTitle>
            </CardHeader>
            <CardContent>
              {localSession.expectedItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No expected items for this location.</p>
              ) : (
                <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
                  {localSession.expectedItems.map((item: StocktakeExpectedItem) => {
                    const scanned = localSession.scannedItems.some(
                      (s) => s.barcode === item.barcode && s.status === "found"
                    );
                    return (
                      <li
                        key={item.copyId}
                        className={cn(
                          "rounded border px-2 py-1",
                          scanned ? "border-green-300 bg-green-50" : "border-muted"
                        )}
                      >
                        <span className="font-mono text-xs">{item.barcode}</span> — {item.title}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {step === "review" && localSession && (
        <Card>
          <CardHeader>
            <CardTitle>Discrepancy review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {discrepancies.length === 0 ? (
              <p role="status" className="text-sm text-green-700">
                No discrepancies — all expected items accounted for.
              </p>
            ) : (
              <>
                <p className="text-sm text-amber-800">
                  {discrepancies.length} discrepancies require review before closing.
                </p>
                <ul className="space-y-2 text-sm">
                  {discrepancies.map((d) => (
                    <li key={`${d.type}-${d.barcode}`} className="rounded border p-2">
                      <span className="font-medium capitalize">{d.type}</span>: {d.title} (
                      <span className="font-mono">{d.barcode}</span>)
                    </li>
                  ))}
                </ul>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={reviewAcknowledged}
                    onChange={(e) => setReviewAcknowledged(e.target.checked)}
                  />
                  I have reviewed all discrepancies
                </label>
              </>
            )}
            {completeError && (
              <div role="alert" className="text-sm text-destructive">
                {completeError}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("scan")}>
                Back to scanning
              </Button>
              <Button onClick={handleComplete} disabled={completing}>
                {completing ? "Closing..." : "Close session"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
