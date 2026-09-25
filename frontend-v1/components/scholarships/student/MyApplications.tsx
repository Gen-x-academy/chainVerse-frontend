"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Trash2, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
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
import { ApplicationStatusBadge } from "@/components/scholarships/shared/ScholarshipStatusBadge";
import { TableRowsSkeleton } from "@/components/scholarships/shared/LoadingSkeleton";
import { EmptyState } from "@/components/scholarships/shared/EmptyState";
import { ErrorBanner } from "@/components/scholarships/shared/ErrorBanner";
import type { ScholarshipApplication } from "@/types/scholarship.types";

export function MyApplications() {
  const router = useRouter();
  const {
    myApplications,
    loading,
    error,
    fetchMyApplications,
    withdrawApplication,
  } = useScholarshipStore();

  const [search, setSearch] = useState("");
  const [withdrawTarget, setWithdrawTarget] =
    useState<ScholarshipApplication | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    fetchMyApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = myApplications.filter(
    (a) =>
      a.scholarshipTitle.toLowerCase().includes(search.toLowerCase()) ||
      a.status.toLowerCase().includes(search.toLowerCase())
  );

  const handleWithdraw = async () => {
    if (!withdrawTarget) return;
    setWithdrawing(true);
    try {
      await withdrawApplication(withdrawTarget.id);
    } finally {
      setWithdrawing(false);
      setWithdrawTarget(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="border-b bg-white px-6 py-4">
        <h1 className="text-2xl font-semibold text-gray-900 ml-12 md:ml-0">
          My Applications
        </h1>
        <p className="text-sm text-gray-500 mt-1 ml-12 md:ml-0">
          Track the status of every scholarship application you have submitted.
        </p>
      </header>

      <main className="flex-1 bg-gray-50 p-6 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-6">

          {error && <ErrorBanner message={error} />}

          {/* Search */}
          <div className="relative max-w-sm">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
              aria-hidden="true"
            />
            <Input
              placeholder="Search applications…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              aria-label="Search my applications"
            />
          </div>

          {loading && <TableRowsSkeleton rows={4} cols={4} />}

          {!loading && filtered.length === 0 && (
            <EmptyState
              icon={FileText}
              title="No applications yet"
              description="Browse available scholarships and submit your first application."
              action={
                <Button
                  className="bg-[#4361EE] hover:bg-blue-700 text-white"
                  onClick={() =>
                    router.push("/students/dashboard/scholarships")
                  }
                >
                  Browse scholarships
                </Button>
              }
            />
          )}

          {!loading && filtered.length > 0 && (
            <Card className="bg-white border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">
                  {filtered.length} application
                  {filtered.length !== 1 ? "s" : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm" aria-label="My scholarship applications">
                    <thead>
                      <tr className="border-t border-b bg-gray-50 text-left">
                        {["Scholarship", "Submitted", "Status", "Actions"].map(
                          (h) => (
                            <th
                              key={h}
                              scope="col"
                              className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filtered.map((app) => (
                        <tr
                          key={app.id}
                          className="hover:bg-gray-50 transition-colors"
                          data-testid={`app-row-${app.id}`}
                        >
                          <td className="px-6 py-4">
                            <p className="font-medium text-gray-900">
                              {app.scholarshipTitle}
                            </p>
                            <p className="text-xs text-gray-400">
                              ID: {app.id}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                            {app.submittedAt
                              ? new Date(app.submittedAt).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  }
                                )
                              : "—"}
                          </td>
                          <td className="px-6 py-4">
                            <ApplicationStatusBadge status={app.status} />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label={`View details for ${app.scholarshipTitle}`}
                                onClick={() =>
                                  router.push(
                                    `/students/dashboard/scholarships/${app.scholarshipId}`
                                  )
                                }
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {app.status === "submitted" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                  aria-label={`Withdraw application for ${app.scholarshipTitle}`}
                                  onClick={() => setWithdrawTarget(app)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-gray-100">
                  {filtered.map((app) => (
                    <div key={app.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-gray-900 text-sm">
                          {app.scholarshipTitle}
                        </p>
                        <ApplicationStatusBadge status={app.status} />
                      </div>
                      <p className="text-xs text-gray-400">
                        {app.submittedAt
                          ? new Date(app.submittedAt).toLocaleDateString()
                          : "Not submitted"}
                      </p>
                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() =>
                            router.push(
                              `/students/dashboard/scholarships/${app.scholarshipId}`
                            )
                          }
                        >
                          View
                        </Button>
                        {app.status === "submitted" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-500 border-red-200 hover:bg-red-50"
                            onClick={() => setWithdrawTarget(app)}
                          >
                            Withdraw
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* ── Withdraw confirmation dialog ────────────────────────────── */}
      <Dialog
        open={!!withdrawTarget}
        onOpenChange={(open) => !open && setWithdrawTarget(null)}
      >
        <DialogContent aria-describedby="withdraw-desc">
          <DialogHeader>
            <DialogTitle>Withdraw application?</DialogTitle>
            <DialogDescription id="withdraw-desc">
              This will permanently remove your application for{" "}
              <strong>{withdrawTarget?.scholarshipTitle}</strong>. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end pt-2">
            <Button
              variant="outline"
              onClick={() => setWithdrawTarget(null)}
              disabled={withdrawing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleWithdraw}
              disabled={withdrawing}
              aria-busy={withdrawing}
            >
              {withdrawing ? "Withdrawing…" : "Yes, withdraw"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
