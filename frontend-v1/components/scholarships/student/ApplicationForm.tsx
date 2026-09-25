"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useScholarshipStore } from "@/store/scholarshipStore";
import { ErrorBanner } from "@/components/scholarships/shared/ErrorBanner";

// ─── Validation schema ────────────────────────────────────────────────────────

const applicationSchema = z.object({
  statement: z
    .string()
    .min(100, "Your personal statement must be at least 100 characters.")
    .max(2000, "Personal statement cannot exceed 2 000 characters."),
  financialNeed: z
    .string()
    .max(1000, "Financial need statement cannot exceed 1 000 characters.")
    .optional(),
});

type ApplicationFormData = z.infer<typeof applicationSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

interface ApplicationFormProps {
  programId: string;
}

export function ApplicationForm({ programId }: ApplicationFormProps) {
  const router = useRouter();
  const {
    selectedProgram: program,
    loading,
    error,
    fetchProgramById,
    submitApplication,
  } = useScholarshipStore();

  const [submitted, setSubmitted] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  useEffect(() => {
    fetchProgramById(programId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId]);

  const form = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: { statement: "", financialNeed: "" },
  });

  const onSubmit = async (data: ApplicationFormData) => {
    try {
      const app = await submitApplication({
        scholarshipId: programId,
        statement: data.statement,
        financialNeed: data.financialNeed || undefined,
      });
      setSubmittedId(app.id);
      setSubmitted(true);
    } catch {
      // Error surfaced from store
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gray-50">
        <Card className="max-w-md w-full bg-white border-gray-200 text-center">
          <CardContent className="pt-10 pb-10 flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2
                className="h-8 w-8 text-green-600"
                aria-hidden="true"
              />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              Application submitted!
            </h2>
            <p className="text-sm text-gray-500">
              Your application (ID: <code className="text-xs bg-gray-100 px-1 rounded">{submittedId}</code>)
              has been received. We will notify you by email when a decision is made.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() =>
                  router.push("/students/dashboard/scholarships/my-applications")
                }
              >
                View my applications
              </Button>
              <Button
                className="flex-1 bg-[#4361EE] hover:bg-blue-700 text-white"
                onClick={() =>
                  router.push("/students/dashboard/scholarships")
                }
              >
                Browse more
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="border-b bg-white px-6 py-4">
        <Button
          variant="ghost"
          size="sm"
          className="mb-3 -ml-1 text-gray-600"
          onClick={() => router.back()}
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" />
          Back
        </Button>
        <h1 className="text-2xl font-semibold text-gray-900 ml-12 md:ml-0">
          Apply: {program?.title ?? "…"}
        </h1>
        <p className="text-sm text-gray-500 ml-12 md:ml-0">
          {program?.sponsorName}
        </p>
      </header>

      <main className="flex-1 bg-gray-50 p-6 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-6">

          {error && (
            <ErrorBanner
              message={error}
              onDismiss={() => useScholarshipStore.setState({ error: null })}
            />
          )}

          {/* Reminders */}
          {program && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4 pb-4">
                <p className="text-sm font-medium text-blue-800 mb-2">
                  Before you apply
                </p>
                <ul className="space-y-1">
                  {program.eligibilityCriteria.map((c, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-blue-700"
                    >
                      <span
                        className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0"
                        aria-hidden="true"
                      />
                      {c}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Form */}
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Your application
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  noValidate
                  aria-label="Scholarship application form"
                  className="space-y-6"
                >
                  {/* Personal statement */}
                  <FormField
                    control={form.control}
                    name="statement"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Personal statement{" "}
                          <span aria-hidden="true" className="text-red-500">
                            *
                          </span>
                        </FormLabel>
                        <FormDescription>
                          Tell us about yourself, your goals, and why you deserve
                          this scholarship. Min 100 characters, max 2 000.
                        </FormDescription>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={8}
                            placeholder="I am applying for this scholarship because…"
                            aria-required="true"
                            aria-describedby="statement-count"
                          />
                        </FormControl>
                        <div
                          id="statement-count"
                          className="text-xs text-gray-400 text-right"
                          aria-live="polite"
                        >
                          {field.value.length} / 2 000
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Financial need (optional) */}
                  <FormField
                    control={form.control}
                    name="financialNeed"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Financial need statement{" "}
                          <span className="text-gray-400 font-normal">
                            (optional)
                          </span>
                        </FormLabel>
                        <FormDescription>
                          If this scholarship is need-based, describe your
                          financial circumstances. Max 1 000 characters.
                        </FormDescription>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={4}
                            placeholder="My household income is… / I rely on scholarships because…"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => router.back()}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-[#4361EE] hover:bg-blue-700 text-white"
                      disabled={loading}
                      aria-busy={loading}
                    >
                      {loading ? (
                        "Submitting…"
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" aria-hidden="true" />
                          Submit application
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
