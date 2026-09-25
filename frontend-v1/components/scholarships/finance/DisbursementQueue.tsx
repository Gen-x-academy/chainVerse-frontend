"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Wallet, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useScholarshipStore } from "@/store/scholarshipStore";
import { PaymentStatusBadge } from "@/components/scholarships/shared/ScholarshipStatusBadge";
import { TableRowsSkeleton } from "@/components/scholarships/shared/LoadingSkeleton";
import { EmptyState } from "@/components/scholarships/shared/EmptyState";
import { ErrorBanner } from "@/components/scholarships/shared/ErrorBanner";
import type { DisbursementRecord, PaymentStatus } from "@/types/scholarship.types";

// ─── Mark-paid form schema ────────────────────────────────────────────────────

const markPaidSchema = z.object({
  txHash: z
    .string()
    .min(20, "Transaction hash must be at least 20 characters.")
    .regex(/^[a-f0-9]+$/i, "Transaction hash must be a valid hex string."),
});

type MarkPaidFormData = z.infer<typeof markPaidSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

const STELLAR_TX_BASE = "https://stellar.expert/explorer/public/tx/";

export function DisbursementQueue() {
  const {
    disbursements,
    loading,
    error,
    fetchDisbursements,
    markDisbursementPaid,
  } = useScholarshipStore();

  const [statusFilter, setStatusFilter] = useState<PaymentStatus | "all">(
    "all"
  );
  const [markPaidTarget, setMarkPaidTarget] =
    useState<DisbursementRecord | null>(null);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    fetchDisbursements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const form = useForm<MarkPaidFormData>({
    resolver: zodResolver(markPaidSchema),
    defaultValues: { txHash: "" },
  });

  const filtered =
    statusFilter === "all"
      ? disbursements
      : disbursements.filter((d) => d.status === statusFilter);

  const totalPending = disbursements.filter((d) => d.status === "pending").length;
  const totalPaid = disbursements.filter((d) => d.status === "paid").length;

  const onMarkPaid = async (data: MarkPaidFormData) => {
    if (!markPaidTarget) return;
    setMarking(true);
    try {
      await markDisbursementPaid(markPaidTarget.id, data.txHash);
      setMarkPaidTarget(null);
      form.reset();
    } finally {
      setMarking(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b bg-white px-6 py-4">
        <h1 className="text-2xl font-semibold text-gray-900 ml-12 md:ml-0">
          Disbursements
        </h1>
        <p className="text-sm text-gray-500 mt-1 ml-12 md:ml-0">
          Manage and track scholarship payment disbursements.
        </p>
      </header>

      <main className="flex-1 bg-gray-50 p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6">

          {error && <ErrorBanner message={error} />}

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total", value: disbursements.length },
              { label: "Pending", value: totalPending },
              { label: "Paid", value: totalPaid },
              {
                label: "Total paid (XLM)",
                value: disbursements
                  .filter((d) => d.status === "paid")
                  .reduce((s, d) => s + d.amount, 0)
                  .toLocaleString(),
              },
            ].map(({ label, value }) => (
              <Card key={label} className="bg-white border-gray-200">
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">
                    {value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filter */}
          <div className="flex items-center gap-3">
            <label
              htmlFor="status-filter"
              className="text-sm text-gray-600 shrink-0"
            >
              Filter by status:
            </label>
            <Select
              value={statusFilter}
              onValueChange={(v) =>
                setStatusFilter(v as PaymentStatus | "all")
              }
            >
              <SelectTrigger
                id="status-filter"
                className="w-40"
                aria-label="Filter disbursements by status"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading && <TableRowsSkeleton rows={3} cols={6} />}

          {!loading && filtered.length === 0 && (
            <EmptyState
              icon={Wallet}
              title="No disbursements found"
              description="Disbursements appear here once applications are approved and ready for payment."
            />
          )}

          {!loading && filtered.length > 0 && (
            <Card className="bg-white border-gray-200">
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  {filtered.length} record{filtered.length !== 1 ? "s" : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table
                    className="w-full text-sm"
                    aria-label="Disbursement records"
                  >
                    <thead>
                      <tr className="border-t border-b bg-gray-50 text-left">
                        {[
                          "Recipient",
                          "Scholarship",
                          "Amount",
                          "Wallet",
                          "Scheduled",
                          "Status",
                          "Actions",
                        ].map((h) => (
                          <th
                            key={h}
                            scope="col"
                            className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filtered.map((d) => (
                        <tr
                          key={d.id}
                          className="hover:bg-gray-50 transition-colors"
                          data-testid={`disb-row-${d.id}`}
                        >
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {d.applicantName}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {d.scholarshipTitle}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                            {d.amount.toLocaleString()} {d.currency}
                          </td>
                          <td className="px-4 py-3">
                            <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                              {d.walletAddress.slice(0, 8)}…
                            </code>
                          </td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                            {new Date(d.scheduledDate).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              }
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <PaymentStatusBadge status={d.status} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {d.txHash && (
                                <a
                                  href={`${STELLAR_TX_BASE}${d.txHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label="View transaction on Stellar Explorer"
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              )}
                              {d.status === "pending" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-700 border-green-200 hover:bg-green-50"
                                  onClick={() => {
                                    form.reset({ txHash: "" });
                                    setMarkPaidTarget(d);
                                  }}
                                  aria-label={`Mark disbursement to ${d.applicantName} as paid`}
                                >
                                  Mark paid
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* ── Mark paid dialog ─────────────────────────────────────── */}
      <Dialog
        open={!!markPaidTarget}
        onOpenChange={(open) => !open && setMarkPaidTarget(null)}
      >
        <DialogContent aria-describedby="mark-paid-desc">
          <DialogHeader>
            <DialogTitle>Mark disbursement as paid</DialogTitle>
            <DialogDescription id="mark-paid-desc">
              Provide the Stellar transaction hash to confirm payment to{" "}
              <strong>{markPaidTarget?.applicantName}</strong> for{" "}
              <strong>
                {markPaidTarget?.amount} {markPaidTarget?.currency}
              </strong>
              .
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onMarkPaid)}
              noValidate
              aria-label="Mark paid form"
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="txHash"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Transaction hash{" "}
                      <span aria-hidden="true" className="text-red-500">
                        *
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g. a1b2c3d4e5f6…"
                        aria-required="true"
                        className="font-mono text-xs"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setMarkPaidTarget(null)}
                  disabled={marking}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  disabled={marking}
                  aria-busy={marking}
                >
                  {marking ? "Saving…" : "Confirm payment"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
