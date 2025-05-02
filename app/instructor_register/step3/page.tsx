"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { BackButton } from "@/components/back-button";
import { StepIndicator } from "@/components/step-indicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  courseProposalSchema,
  type CourseProposalFormData,
} from "@/lib/form-schema";
import { useFormContext } from "@/lib/form-context";

export default function CourseProposalStep() {
  const router = useRouter();
  const { courseProposal, setCourseProposal } = useFormContext();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CourseProposalFormData>({
    resolver: zodResolver(courseProposalSchema),
    defaultValues: {
      courseTitle: courseProposal.courseTitle || "",
      courseDescription: courseProposal.courseDescription || "",
      courseLevel: courseProposal.courseLevel || "",
      courseOutline: courseProposal.courseOutline || "",
    },
  });

  const onSubmit = async (data: CourseProposalFormData) => {
    setIsSubmitting(true);

    try {
      setCourseProposal(data);

      // In a real application, you would submit all the data to your backend here
      // const { personalInfo, professionalExp } = useFormContext();
      // const formData = { ...personalInfo, ...professionalExp, ...data };
      // await submitApplication(formData);

      router.push("/instructor_register/success");
    } catch (error) {
      console.error("Error submitting application:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    // Save current form data before navigating back
    const currentValues = form.getValues();
    setCourseProposal(currentValues);
    router.push("/register/step2");
  };

  return (
    <div className="max-w-3xl mx-auto">
      <BackButton
        href="/register/step2"
        label="Back to Professional Experience"
      />

      <div className="bg-white rounded-lg border py-6 px-20 mt-4">
        <div className="text-center my-8">
          <h1 className="text-3xl font-bold">Become an Instructor</h1>
          <p className="text-muted-foreground mt-2">
            Share your blockchain expertise and earn cryptocurrency while
            teaching others
          </p>
        </div>

        <div className="mt-20">
          <StepIndicator currentStep={3} totalSteps={3} />
        </div>

        <div className=" p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold">Course Proposal</h2>
            <p className="text-muted-foreground text-sm">
              Tell us about the course you'd like to teach
            </p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="courseTitle">Proposed Course Title</Label>
              <Input
                id="courseTitle"
                {...form.register("courseTitle")}
                placeholder="e.g. Advanced Smart Contract Development on Stellar"
                className={
                  form.formState.errors.courseTitle
                    ? "border-destructive focus-visible:ring-destructive"
                    : "bg-[#FCFAF8]"
                }
              />
              {form.formState.errors.courseTitle && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.courseTitle.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="courseDescription">Course Description</Label>
              <Textarea
                id="courseDescription"
                {...form.register("courseDescription")}
                placeholder="Provide a detailed description of your course"
                className={`min-h-[120px] ${
                  form.formState.errors.courseDescription
                    ? "border-destructive focus-visible:ring-destructive"
                    : "bg-[#FCFAF8]"
                }`}
              />
              {form.formState.errors.courseDescription && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.courseDescription.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="courseLevel">Course Level</Label>
              <Select
                onValueChange={(value) => form.setValue("courseLevel", value)}
                defaultValue={form.getValues("courseLevel")}
              >
                <SelectTrigger className="bg-[#FCFAF8]">
                  <SelectValue placeholder="Select the course difficulty level" />
                </SelectTrigger>
                <SelectContent className="bg-[#fff]">
                  <SelectItem value="beginner">
                    Beginner - No prior knowledge required
                  </SelectItem>
                  <SelectItem value="intermediate">
                    Intermediate - Basic knowledge needed
                  </SelectItem>
                  <SelectItem value="advanced">
                    Advanced - Comprehensive understanding required
                  </SelectItem>
                  <SelectItem value="expert">
                    Expert - Deep technical knowledge necessary
                  </SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.courseLevel && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.courseLevel.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="courseOutline">Course Outline</Label>
              <Textarea
                id="courseOutline"
                {...form.register("courseOutline")}
                placeholder="Provide a detailed outline of your course structure and modules"
                className={`min-h-[200px] ${
                  form.formState.errors.courseOutline
                    ? "border-destructive focus-visible:ring-destructive"
                    : "bg-[#FCFAF8]"
                }`}
              />
              {form.formState.errors.courseOutline && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.courseOutline.message}
                </p>
              )}
            </div>
            <div className="flex justify-between pt-4">
              <Button
                type="button"
                variant="outline"
                className="border-[#2457C566] bg-[#fff] px-8"
                onClick={handleBack}
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="px-8 text-[16px]"
              >
                {isSubmitting ? "Processing..." : "Proceed"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
