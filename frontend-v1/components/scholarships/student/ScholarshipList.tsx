"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, GraduationCap, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useScholarshipStore } from "@/store/scholarshipStore";
import { ProgramStatusBadge } from "@/components/scholarships/shared/ScholarshipStatusBadge";
import { ScholarshipCardsSkeleton } from "@/components/scholarships/shared/LoadingSkeleton";
import { EmptyState } from "@/components/scholarships/shared/EmptyState";
import { ErrorBanner } from "@/components/scholarships/shared/ErrorBanner";
import type {
  ScholarshipStatus,
  ScholarshipCategory,
} from "@/types/scholarship.types";

// ─── Category label map ───────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<ScholarshipCategory | "all", string> = {
  all: "All Categories",
  merit: "Merit",
  need_based: "Need-Based",
  diversity: "Diversity",
  stem: "STEM",
  open: "Open",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ScholarshipList() {
  const router = useRouter();
  const { programs, loading, error, filters, fetchPrograms, setFilters } =
    useScholarshipStore();

  const [searchInput, setSearchInput] = useState(filters.search ?? "");

  // Fetch on mount and whenever status/category filter changes
  useEffect(() => {
    fetchPrograms(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.category]);

  // Debounce search so we don't fetch on every keystroke
  useEffect(() => {
    const id = setTimeout(() => {
      setFilters({ ...filters, search: searchInput });
      fetchPrograms({ ...filters, search: searchInput });
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const openPrograms = programs.filter((p) => p.status === "open");

  return (
    <div className="flex-1 flex flex-col">
      {/* ── Page header ──────────────────────────────────────────────── */}
      <header className="border-b bg-white px-6 py-4">
        <h1 className="text-2xl font-semibold text-gray-900 ml-12 md:ml-0">
          Scholarships & Bursaries
        </h1>
        <p className="text-sm text-gray-500 mt-1 ml-12 md:ml-0">
          Browse available funding opportunities and apply in minutes.
        </p>
      </header>

      <main className="flex-1 bg-gray-50 p-6 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* ── Error banner ─────────────────────────────────────────── */}
          {error && (
            <ErrorBanner
              message={error}
              onDismiss={() => useScholarshipStore.setState({ error: null })}
            />
          )}

          {/* ── Filters ──────────────────────────────────────────────── */}
          <section aria-label="Filter scholarships">
            <Card className="bg-white border-gray-200">
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Search */}
                  <div className="relative flex-1">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                      aria-hidden="true"
                    />
                    <Input
                      id="scholarship-search"
                      placeholder="Search by title, sponsor, or keyword…"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      className="pl-9"
                      aria-label="Search scholarships"
                    />
                  </div>

                  {/* Status filter */}
                  <Select
                    value={filters.status ?? "all"}
                    onValueChange={(v) =>
                      setFilters({
                        ...filters,
                        status: v as ScholarshipStatus | "all",
                      })
                    }
                  >
                    <SelectTrigger
                      className="w-full sm:w-44"
                      aria-label="Filter by status"
                    >
                      <Filter
                        className="h-4 w-4 mr-2 text-gray-400"
                        aria-hidden="true"
                      />
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="awarded">Awarded</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Category filter */}
                  <Select
                    value={filters.category ?? "all"}
                    onValueChange={(v) =>
                      setFilters({
                        ...filters,
                        category: v as ScholarshipCategory | "all",
                      })
                    }
                  >
                    <SelectTrigger
                      className="w-full sm:w-44"
                      aria-label="Filter by category"
                    >
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.keys(CATEGORY_LABELS) as Array<
                          ScholarshipCategory | "all"
                        >
                      ).map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {CATEGORY_LABELS[cat]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* ── Stats strip ──────────────────────────────────────────── */}
          {!loading && (
            <p className="text-sm text-gray-500" aria-live="polite">
              Showing <strong className="text-gray-900">{programs.length}</strong>{" "}
              program{programs.length !== 1 ? "s" : ""}
              {openPrograms.length > 0 && (
                <> · <strong className="text-green-700">{openPrograms.length} open</strong></>
              )}
            </p>
          )}

          {/* ── Loading skeleton ──────────────────────────────────────── */}
          {loading && <ScholarshipCardsSkeleton count={6} />}

          {/* ── Empty state ───────────────────────────────────────────── */}
          {!loading && programs.length === 0 && (
            <EmptyState
              icon={GraduationCap}
              title="No scholarships found"
              description="Try adjusting your filters or check back later for new opportunities."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilters({ status: "all", category: "all", search: "" });
                    setSearchInput("");
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          )}

          {/* ── Cards grid ───────────────────────────────────────────── */}
          {!loading && programs.length > 0 && (
            <section aria-label="Scholarship programs">
              <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 list-none p-0">
                {programs.map((program) => (
                  <li key={program.id}>
                    <Card
                      className="bg-white border-gray-200 hover:shadow-md transition-shadow h-full flex flex-col"
                      data-testid={`scholarship-card-${program.id}`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <ProgramStatusBadge status={program.status} />
                          <span className="text-xs text-gray-500 shrink-0">
                            {CATEGORY_LABELS[program.category]}
                          </span>
                        </div>
                        <CardTitle className="text-base font-semibold text-gray-900 leading-snug mt-2">
                          {program.title}
                        </CardTitle>
                        <p className="text-xs text-gray-500">
                          {program.sponsorName}
                        </p>
                      </CardHeader>

                      <CardContent className="flex flex-col flex-1 gap-3">
                        <p className="text-sm text-gray-600 line-clamp-3">
                          {program.description}
                        </p>

                        {/* Award amount */}
                        <div className="flex items-center gap-4 text-sm">
                          <div>
                            <span className="text-xs text-gray-500 block">
                              Award
                            </span>
                            <span className="font-semibold text-gray-900">
                              {program.awardAmount.toLocaleString()}{" "}
                              {program.currency}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 block">
                              Spots left
                            </span>
                            <span className="font-semibold text-gray-900">
                              {program.maxRecipients - program.awardedCount}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 block">
                              Closes
                            </span>
                            <span className="font-semibold text-gray-900">
                              {new Date(program.closeDate).toLocaleDateString(
                                "en-US",
                                { month: "short", day: "numeric", year: "numeric" }
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Actions — pushed to bottom */}
                        <div className="flex gap-2 mt-auto pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() =>
                              router.push(
                                `/students/dashboard/scholarships/${program.id}`
                              )
                            }
                          >
                            View details
                          </Button>
                          {program.status === "open" && (
                            <Button
                              size="sm"
                              className="flex-1 bg-[#4361EE] hover:bg-blue-700 text-white"
                              onClick={() =>
                                router.push(
                                  `/students/dashboard/scholarships/${program.id}/apply`
                                )
                              }
                              aria-label={`Apply for ${program.title}`}
                            >
                              Apply now
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
