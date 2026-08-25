"use client";

import { cn } from "@/lib/utils";

export type QuarantineStatus = "quarantined" | "corrupted" | "restored";

interface QuarantinedFileNoticeProps {
  status: QuarantineStatus;
  fileName: string;
  isLibrarian?: boolean;
  detail?: string;
  onRequestReplacement?: () => void;
  className?: string;
}

/** Fix #985: safe unavailable state for quarantined/corrupted digital files. */
export function QuarantinedFileNotice({
  status,
  fileName,
  isLibrarian = false,
  detail,
  onRequestReplacement,
  className,
}: QuarantinedFileNoticeProps) {
  if (status === "restored") {
    return (
      <p className={cn("text-sm text-emerald-600", className)}>
        “{fileName}” has been restored and is available again.
      </p>
    );
  }

  return (
    <div
      role="alert"
      className={cn(
        "rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900",
        className
      )}
    >
      <p className="font-medium">“{fileName}” is currently unavailable</p>
      <p className="mt-1 text-amber-800">
        This file is {status} and cannot be opened right now.
      </p>
      {isLibrarian && detail && (
        <p className="mt-2 text-xs text-amber-700">Detail: {detail}</p>
      )}
      {isLibrarian && onRequestReplacement && (
        <button
          type="button"
          onClick={onRequestReplacement}
          className="mt-3 text-xs font-medium underline underline-offset-2"
        >
          Request replacement
        </button>
      )}
    </div>
  );
}
