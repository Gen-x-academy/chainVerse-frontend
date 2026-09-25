"use client";

import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  ClipboardList,
  Wallet,
  Ban,
} from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useScholarshipStore } from "@/store/scholarshipStore";
import {
  ApplicationStatusBadge,
  ProgramStatusBadge,
} from "@/components/scholarships/shared/ScholarshipStatusBadge";
import { TableRowsSkeleton } from "@/components/scholarships/shared/LoadingSkeleton";
import { EmptyState } from "@/components/scholarships/shared/EmptyState";
import { ErrorBanner } from "@/components/scholarships/shared/ErrorBanner";
import type {
  ScholarshipProgram,
  ApplicationStatus,
} from "@/types/scholarship.types";
import { Tabs } from "@/components/ui/tabs";
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function AdminOverview() {
  const {
    adminStats,
    programs,
    allApplications,
    loading,
    error,
    fetchAdminStats,
    fetchPrograms,
    fetchAllApplications,
    cancelProgram,
  } = useScholarshipStore();

  const [appStatusFilter, setAppStatusFilter] = useState<
    ApplicationStatus | "all"
  >("all");
  const [appSearch, setAppSearch] = useState("");
  const [cancelTarget, setCancelTarget] =
    useState<ScholarshipProgram | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    fetchAdminStats();
    fetchPrograms();
    fetchAllApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredApps = allApplications.filter((a) => {
    const matchesStatus =
      appStatusFilter === "all" || a.status === appStatusFilter;
    const matchesSearch =
      a.applicantName.toLowerCase().includes(appSearch.toLowerCase()) ||
      a.scholarshipTitle.toLowerCase().includes(appSearch.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelProgram(cancelTarget.id);
    } finally {
      setCancelling(false);
      setCancelTarget(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b bg-white px-6 py-4">
        <h1 className="text-2xl font-semibold text-gray-900 ml-12 md:ml-0">
          Scholarship Administration
        </h1>
        <p className="text-sm text-gray-500 mt-1 ml-12 md:ml-0">
          Platform-wide scholarship oversight.
        </p>
      </header>

      <main className="flex-1 bg-gray-50 p-6 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-6">

          {error && <ErrorBanner message={error} />}

          {/* ── KPI cards ──────────────────────────────────────────── */}
          {adminStats && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                {
                  label: "Total programs",
                  value: adminStats.totalPrograms,
                  icon: BookOpen,
                  color: "text-blue-600",
                  bg: "bg-blue-50",
                },
                {
                  label: "Open programs",
                  value: adminStats.openPrograms,
                  icon: LayoutDashboard,
                  color: "text-green-600",
                  bg: "bg-green-50",
                },
                {
                  label: "Total applications",
                  value: adminStats.totalApplications,
                  icon: Users,
                  color: "text-purple-600",
                  bg: "bg-purple-50",
                },
                {
                  label: "Pending review",
                  value: adminStats.pendingReview,
                  icon: ClipboardList,
                  color: "text-yellow-600",
                  bg: "bg-yellow-50",
                },
                {
                  label: `Disbursed (${adminStats.currency})`,
                  value: adminStats.totalDisbursed.toLocaleString(),
                  icon: Wallet,
                  color: "text-teal-600",
                  bg: "bg-teal-50",
                },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <Card key={label} className="bg-white border-gray-200">
                  <CardContent className="pt-4 pb-4">
                    <div
                      className={`inline-flex p-2 rounded-lg ${bg} mb-2`}
                    >
                      <Icon
                        className={`h-4 w-4 ${color}`}
                        aria-hidden="true"
                      />
                    </div>
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-xl font-bold text-gray-900 mt-0.5">
                      {value}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* ── Tabs ─────────────────────────────────────────────── */}
          <Tabs defaultValue="programs">
            <TabsList className="bg-gray-100">
              <TabsTrigger value="programs">Programs</TabsTrigger>
              <TabsTrigger value="applications">Applications</TabsTrigger>
            </TabsList>

            {/* Programs tab */}
            <TabsContent value="programs" className="mt-4">
              {loading && <TableRowsSkeleton rows={4} cols={5} />}
              {!loading && programs.length === 0 && (
                <EmptyState
                  icon={BookOpen}
                  title="No programs found"
                  description="No scholarship programs have been created yet."
                />
              )}
              {!loading && programs.length > 0 && (
                <Card className="bg-white border-gray-200">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table
                        className="w-full text-sm"
                        aria-label="All scholarship programs"
                      >
                        <thead>
                          <tr className="border-t border-b bg-gray-50 text-left">
                            {[
                              "Title",
                              "Sponsor",
                              "Status",
                              "Applications",
                              "Budget",
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
                          {programs.map((p) => (
                            <tr
                              key={p.id}
                              className="hover:bg-gray-50"
                              data-testid={`admin-prog-row-${p.id}`}
                            >
                              <td className="px-4 py-3 font-medium text-gray-900">
                                {p.title}
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {p.sponsorName}
                              </td>
                              <td className="px-4 py-3">
                                <ProgramStatusBadge status={p.status} />
                              </td>
                              <td className="px-4 py-3 text-gray-700">
                                {p.awardedCount} / {p.maxRecipients}
                              </td>
                              <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                                {p.totalBudget.toLocaleString()} {p.currency}
                              </td>
                              <td className="px-4 py-3">
                                {p.status !== "cancelled" &&
                                  p.status !== "closed" && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                      aria-label={`Cancel program ${p.title}`}
                                      onClick={() => setCancelTarget(p)}
                                    >
                                      <Ban className="h-4 w-4" />
                                    </Button>
                                  )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Applications tab */}
            <TabsContent value="applications" className="mt-4 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Input
                    placeholder="Search applicant or scholarship…"
                    value={appSearch}
                    onChange={(e) => setAppSearch(e.target.value)}
                    className="pl-3"
                    aria-label="Search applications"
                  />
                </div>
                <Select
                  value={appStatusFilter}
                  onValueChange={(v) =>
                    setAppStatusFilter(v as ApplicationStatus | "all")
                  }
                >
                  <SelectTrigger
                    className="w-44"
                    aria-label="Filter by application status"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="under_review">Under review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="disbursed">Disbursed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {loading && <TableRowsSkeleton rows={4} cols={4} />}

              {!loading && filteredApps.length === 0 && (
                <EmptyState
                  icon={Users}
                  title="No applications found"
                  description="Try adjusting your filters."
                />
              )}

              {!loading && filteredApps.length > 0 && (
                <Card className="bg-white border-gray-200">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table
                        className="w-full text-sm"
                        aria-label="All scholarship applications"
                      >
                        <thead>
                          <tr className="border-t border-b bg-gray-50 text-left">
                            {[
                              "Applicant",
                              "Scholarship",
                              "Submitted",
                              "Status",
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
                          {filteredApps.map((a) => (
                            <tr
                              key={a.id}
                              className="hover:bg-gray-50"
                              data-testid={`admin-app-row-${a.id}`}
                            >
                              <td className="px-4 py-3">
                                <p className="font-medium text-gray-900">
                                  {a.applicantName}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {a.applicantEmail}
                                </p>
                              </td>
                              <td className="px-4 py-3 text-gray-700">
                                {a.scholarshipTitle}
                              </td>
                              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                                {a.submittedAt
                                  ? new Date(
                                      a.submittedAt
                                    ).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })
                                  : "—"}
                              </td>
                              <td className="px-4 py-3">
                                <ApplicationStatusBadge status={a.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* ── Cancel confirmation dialog ────────────────────────── */}
      <Dialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
      >
        <DialogContent aria-describedby="cancel-prog-desc">
          <DialogHeader>
            <DialogTitle>Cancel program?</DialogTitle>
            <DialogDescription id="cancel-prog-desc">
              This will cancel{" "}
              <strong>&quot;{cancelTarget?.title}&quot;</strong> and prevent
              further applications or disbursements. This action is irreversible.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end pt-2">
            <Button
              variant="outline"
              onClick={() => setCancelTarget(null)}
              disabled={cancelling}
            >
              Go back
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelling}
              aria-busy={cancelling}
            >
              {cancelling ? "Cancelling…" : "Cancel program"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
