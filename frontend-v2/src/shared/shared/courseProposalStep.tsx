// components/courseProposalStep.tsx
"use client";

import { UseFormReturn } from "react-hook-form";
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
import { CourseProposalFormData } from "@/lib/form-schema";
import { StepIndicator } from "@/components/step-indicator";

type Props = {
  form: UseFormReturn<CourseProposalFormData>;
  onSubmit: () => void;
  isSubmitting: boolean;
  onBack: () => void;
};

export default function CourseProposalStep({
  form,
  onSubmit,
  isSubmitting,
  onBack,
}: Props) {
  return (
    <div className="max-w-3xl mx-auto">
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

        <div className="p-8">
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
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                  <SelectItem value="expert">Expert</SelectItem>
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
                onClick={onBack}
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="px-8 text-[16px]"
              >
                {isSubmitting ? "Processing..." : "Submit"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
