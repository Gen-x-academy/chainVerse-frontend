"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Eye, Send, Ban, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useScholarshipStore } from "@/store/scholarshipStore";
import { ProgramStatusBadge } from "@/components/scholarships/shared/ScholarshipStatusBadge";
import { TableRowsSkeleton } from "@/components/scholarships/shared/LoadingSkeleton";
import { EmptyState } from "@/components/scholarships/shared/EmptyState";
import { ErrorBanner } from "@/components/scholarships/shared/ErrorBanner";
import type { ScholarshipProgram } from "@/types/scholarship.types";

export function SponsorDashboard() {
  const router = useRouter();
  const {
    programs,
    loading,
    error,
    fetchPrograms,
    publishProgram,
    closeProgram,
  } = useScholarshipStore();

  const [confirmAction, setConfirmAction] = useState<{
    type: "publish" | "close";
    program: ScholarshipProgram;
  } | null>(null);
  const [actioning, setActioning] = useState(false);

  // Filter to only this sponsor's programs
  const myPrograms = programs.filter(
    (p) => p.sponsorId === "sponsor-current"
  );

  useEffect(() => {
    fetchPrograms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConfirm = async () => {
    if (!confirmAction) return;
    setActioning(true);
    try {
      if (confirmAction.type === "publish") {
        await publishProgram(confirmAction.program.id);
      } else {
        await closeProgram(confirmAction.program.id);
      }
    } finally {
      setActioning(false);
      setConfirmAction(null);
    }
  };

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalBudget = myPrograms.reduce((s, p) => s + p.totalBudget, 0);
  const totalAwarded = myPrograms.reduce((s, p) => s + p.awardedCount, 0);
  const openCount = myPrograms.filter((p) => p.status === "open").length;

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b bg-white px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 ml-12 md:ml-0">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Sponsor Dashboard
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage your scholarship programs and review submissions.
            </p>
          </div>
          <Button
            className="bg-[#4361EE] hover:bg-blue-700 text-white shrink-0"
            onClick={() => router.push("/sponsors/dashboard/scholarships/new")}
          >
            <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
            New program
          </Button>
        </div>
      </header>

      <main className="flex-1 bg-gray-50 p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6">

          {error && <ErrorBanner message={error} />}

          {/* Stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total programs", value: myPrograms.length },
              { label: "Open programs", value: openCount },
              { label: "Total recipients", value: totalAwarded },
              {
                label: "Total budget",
                value: `${totalBudget.toLocaleString()} XLM`,
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

          {loading && <TableRowsSkeleton rows={3} cols={5} />}

          {!loading && myPrograms.length === 0 && (
            <EmptyState
              icon={LayoutDashboard}
              title="No programs yet"
              description="Create your first scholarship program to start supporting learners."
              action={
                <Button
                  className="bg-[#4361EE] hover:bg-blue-700 text-white"
                  onClick={() =>
                    router.push("/sponsors/dashboard/scholarships/new")
                  }
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create program
                </Button>
              }
            />
          )}

          {!loading && myPrograms.length > 0 && (
            <Card className="bg-white border-gray-200">
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  Your programs
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table
                    className="w-full text-sm"
                    aria-label="Sponsor scholarship programs"
                  >
                    <thead>
                      <tr className="border-t border-b bg-gray-50 text-left">
                        {[
                          "Program",
                          "Status",
                          "Award (XLM)",
                          "Recipients",
                          "Closes",
                          "Actions",
                        ].map((h) => (
                          <th
                            key={h}
                            scope="col"
                            className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {myPrograms.map((prog) => (
                        <tr
                          key={prog.id}
                          className="hover:bg-gray-50 transition-colors"
                          data-testid={`sponsor-prog-row-${prog.id}`}
                        >
                          <td className="px-6 py-4">
                            <p className="font-medium text-gray-900">
                              {prog.title}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <ProgramStatusBadge status={prog.status} />
                          </td>
                          <td className="px-6 py-4 text-gray-700">
                            {prog.awardAmount.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-gray-700">
                            {prog.awardedCount} / {prog.maxRecipients}
                          </td>
                          <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                            {new Date(prog.closeDate).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              }
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label={`View ${prog.title}`}
                                onClick={() =>
                                  router.push(
                                    `/students/dashboard/scholarships/${prog.id}`
                                  )
                                }
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {prog.status === "draft" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-green-600 hover:text-green-800 hover:bg-green-50"
                                  aria-label={`Publish ${prog.title}`}
                                  onClick={() =>
                                    setConfirmAction({
                                      type: "publish",
                                      program: prog,
                                    })
                                  }
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                              )}
                              {prog.status === "open" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-orange-500 hover:text-orange-700 hover:bg-orange-50"
                                  aria-label={`Close ${prog.title}`}
                                  onClick={() =>
                                    setConfirmAction({
                                      type: "close",
                                      program: prog,
                                    })
                                  }
                                >
                                  <Ban className="h-4 w-4" />
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

      {/* ── Confirm dialog ────────────────────────────────────────── */}
      <Dialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <DialogContent aria-describedby="confirm-action-desc">
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.type === "publish"
                ? "Publish program?"
                : "Close program?"}
            </DialogTitle>
            <DialogDescription id="confirm-action-desc">
              {confirmAction?.type === "publish"
                ? `"${confirmAction.program.title}" will become publicly visible and open for applications immediately.`
                : `"${confirmAction?.program.title}" will stop accepting new applications. This cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end pt-2">
            <Button
              variant="outline"
              onClick={() => setConfirmAction(null)}
              disabled={actioning}
            >
              Cancel
            </Button>
            <Button
              className={
                confirmAction?.type === "publish"
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-orange-500 hover:bg-orange-600 text-white"
              }
              onClick={handleConfirm}
              disabled={actioning}
              aria-busy={actioning}
            >
              {actioning
                ? "Working…"
                : confirmAction?.type === "publish"
                ? "Publish"
                : "Close program"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
