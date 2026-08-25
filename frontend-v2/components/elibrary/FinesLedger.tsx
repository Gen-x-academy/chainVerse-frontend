"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface FinesLedgerEntry {
  id: string;
  type: "fine" | "replacement" | "waiver" | "payment" | "refund" | "adjustment";
  amount: number;
  createdAt: string;
  reference: string;
}

interface FinesLedgerProps {
  entries: FinesLedgerEntry[];
  isLoading?: boolean;
  error?: string;
}

/** #973: Read-only, paginated-ready ledger of a patron's fine/payment history. */
export function FinesLedger({ entries, isLoading, error }: FinesLedgerProps) {
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading ledger…</p>;
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No charges or payments yet.</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Charge & Payment Ledger</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.map((entry) => (
          <div key={entry.id} className="flex justify-between border-b py-2 text-sm">
            <span className="font-mono text-xs text-muted-foreground">{entry.reference}</span>
            <span className="capitalize">{entry.type}</span>
            <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleDateString()}</time>
            <span>${entry.amount.toFixed(2)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
