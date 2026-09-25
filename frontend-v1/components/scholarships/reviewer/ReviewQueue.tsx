"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ClipboardList, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useScholarshipStore } from "@/store/scholarshipStore";
import { TableRowsSkeleton } from "@/components/scholarships/shared/LoadingSkeleton";
import { EmptyState } from "@/components/scholarships/shared/EmptyState";
import { ErrorBanner } from "@/components/scholarships/shared/ErrorBanner";
import type { ReviewItem, ReviewDecision } from "@/types/scholarship.types";

// ─── Decision form schema ──────────────────────────────────────────────────────

const decisionSchema = z.object({
  decision: z.enum(["approve", "reject", "request_info"], {
    required_error: "Please select a decision.",
  }),
  notes: z
    .string()
    .min(10, "Notes must be at least 10 characters.")
    .max(1000, "Notes cannot exceed 1 000 characters."),
});

type DecisionFormData = z.infer<typeof decisionSchema>;

// ─── Decision config ───────────────────────────────────────────────────────────

const DECISION_CONFIG: Record<
  ReviewDecision,
  { label: string; icon: typeof CheckCircle2; color: string; bg: string }
> = {
  approve: {
    label: "Approve",
    icon: CheckCircle2,
    color: "text-green-700",
    bg: "bg-green-600 hover:bg-green-700 text-white",
  },
  reject: {
    label: "Reject",
    icon: XCircle,
    color: "text-red-700",
    bg: "bg-red-600 hover:bg-red-700 text-white",
  },
  request_info: {
    label: "Request info",
    icon: HelpCircle,
    color: "text-yellow-700",
    bg: "bg-yellow-500 hover:bg-yellow-600 text-white",
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ReviewQueue() {
  const {
    reviewQueue,
    loading,
    error,
    fetchReviewQueue,
    submitReviewDecision,
  } = useScholarshipStore();

  const [selected, setSelected] = useState<ReviewItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchReviewQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const form = useForm<DecisionFormData>({
    resolver: zodResolver(decisionSchema),
    defaultValues: { decision: undefined, notes: "" },
  });

  const openReview = (item: ReviewItem) => {
    form.reset({ decision: undefined, notes: "" });
    setSelected(item);
  };

  const onDecisionSubmit = async (data: DecisionFormData) => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await submitReviewDecision({
        applicationId: selected.applicationId,
        decision: data.decision,
        notes: data.notes,
      });
      setSelected(null);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedDecision = form.watch("decision") as ReviewDecision | undefined;

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b bg-white px-6 py-4">
        <h1 className="text-2xl font-semibold text-gray-900 ml-12 md:ml-0">
          Review Queue
        </h1>
        <p className="text-sm text-gray-500 mt-1 ml-12 md:ml-0">
          Review submitted applications and record your decision.
        </p>
      </header>

      <main className="flex-1 bg-gray-50 p-6 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-6">

          {error && <ErrorBanner message={error} />}

          {/* Queue count */}
          {!loading && reviewQueue.length > 0 && (
            <div
              className="flex items-center gap-2"
              aria-live="polite"
              aria-atomic="true"
            >
              <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
                {reviewQueue.length} pending
              </Badge>
              <span className="text-sm text-gray-500">
                application{reviewQueue.length !== 1 ? "s" : ""} awaiting review
              </span>
            </div>
          )}

          {loading && <TableRowsSkeleton rows={3} cols={4} />}

          {!loading && reviewQueue.length === 0 && (
            <EmptyState
              icon={ClipboardList}
              title="Queue is clear"
              description="All applications have been reviewed. Check back later for new submissions."
            />
          )}

          {!loading && reviewQueue.length > 0 && (
            <div className="space-y-4">
              {reviewQueue.map((item) => (
                <Card
                  key={item.applicationId}
                  className="bg-white border-gray-200"
                  data-testid={`review-item-${item.applicationId}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div>
                        <CardTitle className="text-base font-semibold">
                          {item.applicantName}
                        </CardTitle>
                        <p className="text-sm text-gray-500">
                          {item.applicantEmail}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Scholarship: {item.scholarshipTitle}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className="text-xs text-gray-400">
                          Submitted{" "}
                          {new Date(item.submittedAt).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }
                          )}
                        </span>
                        <Button
                          size="sm"
                          className="bg-[#4361EE] hover:bg-blue-700 text-white"
                          onClick={() => openReview(item)}
                          aria-label={`Review application from ${item.applicantName}`}
                        >
                          Review
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 line-clamp-3">
                      {item.statement}
                    </p>
                    {item.financialNeed && (
                      <details className="mt-2">
                        <summary className="text-xs text-blue-600 cursor-pointer select-none">
                          Financial need statement
                        </summary>
                        <p className="text-sm text-gray-600 mt-1">
                          {item.financialNeed}
                        </p>
                      </details>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Review decision dialog ────────────────────────────────── */}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent
          className="max-w-lg"
          aria-describedby="review-dialog-desc"
        >
          <DialogHeader>
            <DialogTitle>
              Reviewing: {selected?.applicantName}
            </DialogTitle>
            <DialogDescription id="review-dialog-desc">
              Read the application carefully, then record your decision and notes.
            </DialogDescription>
          </DialogHeader>

          {/* Application statement (read-only) */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 max-h-40 overflow-y-auto text-sm text-gray-700">
            <p className="font-medium text-xs text-gray-500 uppercase tracking-wide">
              Personal statement
            </p>
            <p>{selected?.statement}</p>
            {selected?.financialNeed && (
              <>
                <p className="font-medium text-xs text-gray-500 uppercase tracking-wide pt-1">
                  Financial need
                </p>
                <p>{selected.financialNeed}</p>
              </>
            )}
          </div>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onDecisionSubmit)}
              noValidate
              aria-label="Review decision form"
              className="space-y-4"
            >
              {/* Decision buttons */}
              <FormField
                control={form.control}
                name="decision"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Decision{" "}
                      <span aria-hidden="true" className="text-red-500">
                        *
                      </span>
                    </FormLabel>
                    <div
                      className="flex gap-2"
                      role="group"
                      aria-label="Select a decision"
                    >
                      {(
                        Object.entries(DECISION_CONFIG) as [
                          ReviewDecision,
                          (typeof DECISION_CONFIG)[ReviewDecision],
                        ][]
                      ).map(([value, config]) => {
                        const Icon = config.icon;
                        const isActive = field.value === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            role="radio"
                            aria-checked={isActive}
                            onClick={() => field.onChange(value)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4361EE] ${
                              isActive
                                ? config.bg
                                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <Icon className="h-4 w-4" aria-hidden="true" />
                            {config.label}
                          </button>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Reviewer notes{" "}
                      <span aria-hidden="true" className="text-red-500">
                        *
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={4}
                        placeholder="Explain your decision clearly. These notes are shared with the applicant."
                        aria-required="true"
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
                  onClick={() => setSelected(null)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className={`flex-1 ${
                    selectedDecision
                      ? DECISION_CONFIG[selectedDecision].bg
                      : "bg-[#4361EE] hover:bg-blue-700 text-white"
                  }`}
                  disabled={submitting || !selectedDecision}
                  aria-busy={submitting}
                >
                  {submitting ? "Submitting…" : "Submit decision"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
