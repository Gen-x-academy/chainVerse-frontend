"use client";

/**
 * Accessible confirmation surface for CAPSTONE-085. The panel renders only
 * status and stable error codes; it never renders private notes, evidence,
 * destination addresses or provider memos.
 */
import { fundingPanelModel, type FundingPanelModel } from "../escrow-funding-api";
import type { ConfirmFundingResult } from "../escrow-confirmation";

export interface EscrowFundingPanelProps {
  result?: ConfirmFundingResult;
  pending?: boolean;
  /** Role-aware: derived from the caller's permissions, not from this component. */
  canConfirm?: boolean;
  onConfirm: () => void;
  onRetry: () => void;
}

const STATE_LABEL: Record<FundingPanelModel["state"], string> = {
  loading: "Loading",
  empty: "Not started",
  error: "Action needed",
  conflict: "Conflict",
  success: "Confirmed",
};

export function EscrowFundingPanel({ result, pending, canConfirm, onConfirm, onRetry }: EscrowFundingPanelProps) {
  const model = fundingPanelModel(result, { pending, canConfirm });
  const isError = model.state === "error" || model.state === "conflict";

  return (
    <section aria-labelledby="escrow-funding-heading" aria-busy={pending || undefined} className="rounded-lg border p-4">
      <h2 id="escrow-funding-heading" className="text-lg font-semibold">
        Project escrow funding
      </h2>
      <p className="text-sm text-muted-foreground">Status: {STATE_LABEL[model.state]}</p>

      <div
        className="mt-2 text-sm"
        role={isError ? "alert" : "status"}
        aria-live={isError ? "assertive" : "polite"}
        data-state={model.state}
      >
        {model.message}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {model.canConfirm && (
          <button type="button" onClick={onConfirm} disabled={pending} className="rounded-md border px-3 py-2 focus-visible:outline focus-visible:outline-2">
            Confirm funding
          </button>
        )}
        {model.retryable && (
          <button type="button" onClick={onRetry} disabled={pending} className="rounded-md border px-3 py-2 focus-visible:outline focus-visible:outline-2">
            Reload funding status
          </button>
        )}
      </div>
    </section>
  );
}

export default EscrowFundingPanel;
