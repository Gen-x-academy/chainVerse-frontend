"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Users,
  DollarSign,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useScholarshipStore } from "@/store/scholarshipStore";
import { ProgramStatusBadge } from "@/components/scholarships/shared/ScholarshipStatusBadge";
import { ScholarshipCardsSkeleton } from "@/components/scholarships/shared/LoadingSkeleton";
import { ErrorBanner } from "@/components/scholarships/shared/ErrorBanner";

interface ScholarshipDetailProps {
  programId: string;
}

export function ScholarshipDetail({ programId }: ScholarshipDetailProps) {
  const router = useRouter();
  const {
    selectedProgram: program,
    loading,
    error,
    fetchProgramById,
    clearSelectedProgram,
  } = useScholarshipStore();

  useEffect(() => {
    fetchProgramById(programId);
    return () => clearSelectedProgram();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId]);

  if (loading) {
    return (
      <div className="p-6">
        <ScholarshipCardsSkeleton count={1} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorBanner message={error} />
      </div>
    );
  }

  if (!program) return null;

  const spotsLeft = program.maxRecipients - program.awardedCount;
  const isOpen = program.status === "open";

  return (
    <div className="flex-1 flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="border-b bg-white px-6 py-4">
        <Button
          variant="ghost"
          size="sm"
          className="mb-3 -ml-1 text-gray-600"
          onClick={() => router.back()}
          aria-label="Go back to scholarship list"
        >
          <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" />
          Back
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ProgramStatusBadge status={program.status} />
              <span className="text-xs text-gray-500">{program.sponsorName}</span>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {program.title}
            </h1>
          </div>
          {isOpen && (
            <Button
              className="bg-[#4361EE] hover:bg-blue-700 text-white shrink-0"
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
      </header>

      <main className="flex-1 bg-gray-50 p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* ── At-a-glance stats ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {
                label: "Award amount",
                value: `${program.awardAmount.toLocaleString()} ${program.currency}`,
                icon: DollarSign,
                color: "text-blue-600",
                bg: "bg-blue-50",
              },
              {
                label: "Spots remaining",
                value: `${spotsLeft} / ${program.maxRecipients}`,
                icon: Users,
                color: "text-purple-600",
                bg: "bg-purple-50",
              },
              {
                label: "Opens",
                value: new Date(program.openDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }),
                icon: Calendar,
                color: "text-green-600",
                bg: "bg-green-50",
              },
              {
                label: "Closes",
                value: new Date(program.closeDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }),
                icon: Calendar,
                color: "text-orange-600",
                bg: "bg-orange-50",
              },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <Card key={label} className="bg-white border-gray-200">
                <CardContent className="pt-4 pb-4">
                  <div className={`inline-flex p-2 rounded-lg ${bg} mb-2`}>
                    <Icon className={`h-4 w-4 ${color}`} aria-hidden="true" />
                  </div>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-base font-semibold text-gray-900">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ── Description ──────────────────────────────────────────── */}
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-base font-semibold">About this scholarship</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700 leading-relaxed">
                {program.description}
              </p>
            </CardContent>
          </Card>

          {/* ── Eligibility criteria ──────────────────────────────────── */}
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
                Eligibility criteria
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2" aria-label="Eligibility criteria list">
                {program.eligibilityCriteria.map((criterion, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span
                      className="mt-1 h-1.5 w-1.5 rounded-full bg-[#4361EE] shrink-0"
                      aria-hidden="true"
                    />
                    {criterion}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* ── Required documents ───────────────────────────────────── */}
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" aria-hidden="true" />
                Required documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2" aria-label="Required documents list">
                {program.requiredDocuments.map((doc, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span
                      className="mt-1 h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0"
                      aria-hidden="true"
                    />
                    {doc}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Separator />

          {/* ── CTA footer ───────────────────────────────────────────── */}
          {isOpen ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2">
              <p className="text-sm text-gray-600">
                Ready to apply? Make sure you meet all the eligibility criteria
                before submitting.
              </p>
              <Button
                className="bg-[#4361EE] hover:bg-blue-700 text-white w-full sm:w-auto"
                onClick={() =>
                  router.push(
                    `/students/dashboard/scholarships/${program.id}/apply`
                  )
                }
              >
                Start application
              </Button>
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-2">
              This scholarship is no longer accepting applications.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
