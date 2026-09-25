"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useScholarshipStore } from "@/store/scholarshipStore";
import { ErrorBanner } from "@/components/scholarships/shared/ErrorBanner";

// ─── Validation schema ────────────────────────────────────────────────────────

const createProgramSchema = z
  .object({
    title: z.string().min(5, "Title must be at least 5 characters."),
    description: z
      .string()
      .min(20, "Description must be at least 20 characters."),
    category: z.enum(["merit", "need_based", "diversity", "stem", "open"], {
      required_error: "Please select a category.",
    }),
    totalBudget: z.coerce
      .number()
      .positive("Total budget must be a positive number."),
    awardAmount: z.coerce
      .number()
      .positive("Award amount must be a positive number."),
    currency: z.string().min(1, "Please select a currency."),
    maxRecipients: z.coerce
      .number()
      .int()
      .positive("Max recipients must be a positive integer."),
    eligibilityCriteria: z
      .string()
      .min(10, "Enter at least one eligibility criterion."),
    requiredDocuments: z
      .string()
      .min(5, "Enter at least one required document."),
    openDate: z.string().min(1, "Open date is required."),
    closeDate: z.string().min(1, "Close date is required."),
  })
  .refine((d) => new Date(d.closeDate) > new Date(d.openDate), {
    message: "Close date must be after open date.",
    path: ["closeDate"],
  })
  .refine((d) => d.awardAmount <= d.totalBudget, {
    message: "Award amount cannot exceed the total budget.",
    path: ["awardAmount"],
  });

type CreateProgramFormData = z.infer<typeof createProgramSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

export function CreateProgramForm() {
  const router = useRouter();
  const { loading, error, createProgram } = useScholarshipStore();
  const [created, setCreated] = useState(false);

  const form = useForm<CreateProgramFormData>({
    resolver: zodResolver(createProgramSchema),
    defaultValues: {
      title: "",
      description: "",
      category: undefined,
      totalBudget: 0,
      awardAmount: 0,
      currency: "XLM",
      maxRecipients: 1,
      eligibilityCriteria: "",
      requiredDocuments: "",
      openDate: "",
      closeDate: "",
    },
  });

  const onSubmit = async (data: CreateProgramFormData) => {
    try {
      await createProgram(data);
      setCreated(true);
    } catch {
      // surfaced from store
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (created) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <Card className="max-w-md w-full bg-white border-gray-200 text-center">
          <CardContent className="pt-10 pb-10 flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              Program created!
            </h2>
            <p className="text-sm text-gray-500">
              Your scholarship program has been saved as a draft. Publish it
              from the dashboard when you are ready.
            </p>
            <Button
              className="bg-[#4361EE] hover:bg-blue-700 text-white w-full"
              onClick={() => router.push("/sponsors/dashboard")}
            >
              Go to dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
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
          Create scholarship program
        </h1>
      </header>

      <main className="flex-1 bg-gray-50 p-6 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-6">

          {error && (
            <ErrorBanner
              message={error}
              onDismiss={() => useScholarshipStore.setState({ error: null })}
            />
          )}

          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Program details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  noValidate
                  aria-label="Create scholarship program form"
                  className="space-y-5"
                >
                  {/* Title */}
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Program title <span aria-hidden="true" className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g. STEM Excellence Award 2027" aria-required="true" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Description */}
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description <span aria-hidden="true" className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={4} placeholder="Describe the program's purpose and impact." aria-required="true" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Category */}
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category <span aria-hidden="true" className="text-red-500">*</span></FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger aria-required="true">
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="merit">Merit</SelectItem>
                            <SelectItem value="need_based">Need-Based</SelectItem>
                            <SelectItem value="diversity">Diversity</SelectItem>
                            <SelectItem value="stem">STEM</SelectItem>
                            <SelectItem value="open">Open</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Budget row */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="totalBudget"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Total budget <span aria-hidden="true" className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input {...field} type="number" min={1} aria-required="true" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="awardAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Award per recipient <span aria-hidden="true" className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input {...field} type="number" min={1} aria-required="true" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Currency + max recipients */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Currency <span aria-hidden="true" className="text-red-500">*</span></FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="XLM">XLM</SelectItem>
                              <SelectItem value="USD">USD</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="maxRecipients"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max recipients <span aria-hidden="true" className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input {...field} type="number" min={1} aria-required="true" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Eligibility criteria */}
                  <FormField
                    control={form.control}
                    name="eligibilityCriteria"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Eligibility criteria <span aria-hidden="true" className="text-red-500">*</span></FormLabel>
                        <FormDescription>One criterion per line.</FormDescription>
                        <FormControl>
                          <Textarea {...field} rows={4} placeholder={"Enrolled student with GPA ≥ 3.5\nPursuing a STEM degree"} aria-required="true" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Required documents */}
                  <FormField
                    control={form.control}
                    name="requiredDocuments"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Required documents <span aria-hidden="true" className="text-red-500">*</span></FormLabel>
                        <FormDescription>One document per line.</FormDescription>
                        <FormControl>
                          <Textarea {...field} rows={3} placeholder={"Academic transcript\nPersonal statement (500 words)"} aria-required="true" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="openDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Open date <span aria-hidden="true" className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input {...field} type="date" aria-required="true" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="closeDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Close date <span aria-hidden="true" className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input {...field} type="date" aria-required="true" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Submit */}
                  <div className="flex gap-3 pt-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-[#4361EE] hover:bg-blue-700 text-white"
                      disabled={loading}
                      aria-busy={loading}
                    >
                      {loading ? "Saving…" : "Save as draft"}
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
