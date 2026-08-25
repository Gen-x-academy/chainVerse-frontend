"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type PaymentStatus = "idle" | "connecting" | "pending" | "success" | "error";

interface StellarFinePaymentProps {
  amountDue: number;
  asset?: string;
  network?: string;
  onPay: () => Promise<{ txHash: string }>;
}

/** #975: Minimal wallet-pay flow for settling a library fine on Stellar. */
export function StellarFinePayment({
  amountDue,
  asset = "USDC",
  network = "Stellar Mainnet",
  onPay,
}: StellarFinePaymentProps) {
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);

  const handlePay = async () => {
    if (status === "pending") return;
    setStatus("pending");
    try {
      const { txHash } = await onPay();
      setTxHash(txHash);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pay Fine — {amountDue.toFixed(2)} {asset}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">Network: {network}</p>
        {status === "success" && txHash && (
          <p className="text-sm text-green-600">Paid. Receipt: {txHash}</p>
        )}
        {status === "error" && <p className="text-sm text-destructive">Payment failed. Try again.</p>}
        <Button onClick={handlePay} disabled={status === "pending" || status === "success"}>
          {status === "pending" ? "Awaiting wallet approval…" : "Pay with Wallet"}
        </Button>
      </CardContent>
    </Card>
  );
}
