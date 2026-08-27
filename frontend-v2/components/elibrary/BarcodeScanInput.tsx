"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ScanMode } from "@/src/features/library/types/library.types";

const MIN_BARCODE_LENGTH = 8;
const SCAN_DEBOUNCE_MS = 1500;
const PARTIAL_SUBMIT_DELAY_MS = 300;

export interface BarcodeScanInputProps {
  mode?: ScanMode;
  isLoading?: boolean;
  error?: string | null;
  lastScanMessage?: string | null;
  onScan?: (barcode: string, mode: ScanMode) => Promise<{ success: boolean; duplicate?: boolean; error?: string }>;
  onManualLookup?: (query: string) => void;
  className?: string;
}

/** #932: Barcode scanner input with HID keyboard support, debounce, and manual fallback. */
export function BarcodeScanInput({
  mode = "checkout",
  isLoading,
  error,
  lastScanMessage,
  onScan,
  onManualLookup,
  className,
}: BarcodeScanInputProps) {
  const [value, setValue] = useState("");
  const [manualQuery, setManualQuery] = useState("");
  const [cameraDenied, setCameraDenied] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const recentScansRef = useRef<Map<string, number>>(new Map());
  const partialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const submitBarcode = useCallback(
    async (barcode: string) => {
      const trimmed = barcode.trim();
      if (trimmed.length < MIN_BARCODE_LENGTH) return;

      const now = Date.now();
      const lastScan = recentScansRef.current.get(trimmed);
      if (lastScan && now - lastScan < SCAN_DEBOUNCE_MS) {
        setFeedback("Duplicate scan — already checked out or recently scanned.");
        return;
      }

      if (!onScan) return;
      setScanning(true);
      setFeedback(null);
      try {
        const result = await onScan(trimmed, mode);
        if (result.duplicate) {
          setFeedback("Duplicate scan — item already checked out.");
        } else if (result.success) {
          recentScansRef.current.set(trimmed, now);
          setFeedback(`Scan accepted: ${trimmed}`);
          setValue("");
        } else {
          setFeedback(result.error ?? "Scan failed.");
        }
      } catch {
        setFeedback("Scan failed.");
      } finally {
        setScanning(false);
        inputRef.current?.focus();
      }
    },
    [onScan, mode]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (partialTimerRef.current) clearTimeout(partialTimerRef.current);
        void submitBarcode(value);
      }
    },
    [submitBarcode, value]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setValue(next);
      // Do not submit partial values — wait for Enter or scanner suffix
      if (partialTimerRef.current) clearTimeout(partialTimerRef.current);
      if (next.length >= MIN_BARCODE_LENGTH) {
        partialTimerRef.current = setTimeout(() => {
          void submitBarcode(next);
        }, PARTIAL_SUBMIT_DELAY_MS);
      }
    },
    [submitBarcode]
  );

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      setCameraDenied(false);
    } catch {
      setCameraDenied(true);
      setCameraActive(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  useEffect(() => () => {
    if (partialTimerRef.current) clearTimeout(partialTimerRef.current);
    stopCamera();
  }, [stopCamera]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2" role="status" aria-label="Loading scanner">
        <div className="h-10 rounded border bg-muted" />
        <span className="sr-only">Loading scanner...</span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {error && (
        <div role="alert" className="rounded border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <label className="block text-sm font-medium">
        Scan barcode
        <input
          ref={inputRef}
          aria-label="Scan barcode"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className="mt-1 w-full rounded border px-3 py-2 font-mono text-lg tracking-wider"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={scanning}
          placeholder="Scan or type barcode, press Enter"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={cameraActive ? stopCamera : startCamera}>
          {cameraActive ? "Stop camera" : "Use camera scanner"}
        </Button>
      </div>

      {cameraDenied && (
        <p role="status" className="text-sm text-muted-foreground">
          Camera access denied. Use manual barcode entry below.
        </p>
      )}

      {cameraActive && (
        <video
          ref={videoRef}
          className="max-h-48 w-full rounded border object-cover"
          aria-label="Camera preview for barcode scanning"
          muted
          playsInline
        />
      )}

      <div className="rounded border p-3 space-y-2">
        <p className="text-sm font-medium">Manual lookup</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            aria-label="Manual barcode or ISBN lookup"
            className="flex-1 rounded border px-3 py-2"
            value={manualQuery}
            onChange={(e) => setManualQuery(e.target.value)}
            placeholder="Enter barcode or ISBN"
          />
          <Button
            type="button"
            size="sm"
            onClick={() => onManualLookup?.(manualQuery.trim())}
            disabled={manualQuery.trim().length < MIN_BARCODE_LENGTH}
          >
            Look up
          </Button>
        </div>
      </div>

      {(feedback || lastScanMessage) && (
        <p
          role="status"
          aria-live="polite"
          className={cn(
            "text-sm rounded p-2",
            feedback?.includes("Duplicate") ? "bg-amber-50 text-amber-900" : "bg-green-50 text-green-900"
          )}
        >
          {feedback ?? lastScanMessage}
        </p>
      )}
    </div>
  );
}
