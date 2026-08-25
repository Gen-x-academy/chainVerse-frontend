"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface FineWaiverFormProps {
  chargeId: string;
  maxAmount: number;
  onSubmit: (input: { chargeId: string; amount: number; reason: string }) => Promise<void>;
}

/** #974: Staff-only form to waive or adjust a fine, with a mandatory reason. */
export function FineWaiverForm({ chargeId, maxAmount, onSubmit }: FineWaiverFormProps) {
  const [amount, setAmount] = useState(maxAmount);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setStatus("submitting");
    try {
      await onSubmit({ chargeId, amount, reason });
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Waive or Adjust Charge</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="number"
            min={0}
            max={maxAmount}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <textarea
            required
            placeholder="Reason for waiver/adjustment (required)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          {status === "error" && (
            <p className="text-sm text-destructive">Could not submit. Please try again.</p>
          )}
          <Button type="submit" disabled={status === "submitting" || !reason.trim()}>
            {status === "submitting" ? "Submitting…" : "Confirm Adjustment"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
