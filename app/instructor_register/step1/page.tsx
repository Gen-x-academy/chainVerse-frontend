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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  personalInfoSchema,
  type PersonalInfoFormData,
} from "@/lib/form-schema";
import { useFormContext } from "@/lib/form-context";

export default function PersonalInfoStep() {
  const router = useRouter();
  const { personalInfo, setPersonalInfo } = useFormContext();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PersonalInfoFormData>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      firstName: personalInfo.firstName || "",
      lastName: personalInfo.lastName || "",
      email: personalInfo.email || "",
      phone: personalInfo.phone || "",
      location: personalInfo.location || "",
      language: personalInfo.language || "",
    },
  });

  const onSubmit = async (data: PersonalInfoFormData) => {
    setIsSubmitting(true);

    try {
      setPersonalInfo(data);
      router.push("/instructor_register/step2");
    } catch (error) {
      console.error("Error saving form data:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <BackButton href="/" />
      <div className="bg-white rounded-lg border py-6 px-20 mt-4">
        <div className="text-center my-8  ">
          <h1 className="text-3xl font-medium">Become an Instructor</h1>
          <p className="text-muted-foreground text-xl mt-2">
            Share your blockchain expertise and earn cryptocurrency while
            teaching others
          </p>
        </div>

        {/* step indicator */}
        <div className="mt-20">
          <StepIndicator currentStep={1} totalSteps={3} />
        </div>

        <div className=" p-8 ">
          <div className="mb-6">
            <h2 className="text-xl font-semibold">Personal Information</h2>
            <p className="text-muted-foreground text-sm">
              Tell us about yourself and your experience
            </p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  {...form.register("firstName")}
                  placeholder="Enter your first name"
                  className={
                    form.formState.errors.firstName
                      ? "border-destructive focus-visible:ring-destructive"
                      : "bg-[#FCFAF8]"
                  }
                />
                {form.formState.errors.firstName && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.firstName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  {...form.register("lastName")}
                  placeholder="Enter your last name"
                  className={
                    form.formState.errors.lastName
                      ? "border-destructive focus-visible:ring-destructive"
                      : "bg-[#FCFAF8]"
                  }
                />
                {form.formState.errors.lastName && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                {...form.register("email")}
                placeholder="your.email@example.com"
                className={
                  form.formState.errors.email
                    ? "border-destructive focus-visible:ring-destructive"
                    : "bg-[#FCFAF8]"
                }
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number (Optional)</Label>
              <Input
                id="phone"
                {...form.register("phone")}
                placeholder="+1 (555) 123-4567"
                className="bg-[#FCFAF8]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                {...form.register("location")}
                placeholder="City, Country"
                className={
                  form.formState.errors.location
                    ? "border-destructive focus-visible:ring-destructive"
                    : "bg-[#FCFAF8]"
                }
              />
              {form.formState.errors.location && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.location.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Language Spoken</Label>
              <Select
                onValueChange={(value: string) =>
                  form.setValue("language", value)
                }
                defaultValue={form.getValues("language")}
              >
                <SelectTrigger className="bg-[#FCFAF8]">
                  <SelectValue placeholder="Select languages you speak" />
                </SelectTrigger>
                <SelectContent className="bg-[#fff]">
                  <SelectItem value="english">English</SelectItem>
                  <SelectItem value="spanish">Spanish</SelectItem>
                  <SelectItem value="french">French</SelectItem>
                  <SelectItem value="german">German</SelectItem>
                  <SelectItem value="chinese">Chinese</SelectItem>
                  <SelectItem value="japanese">Japanese</SelectItem>
                  <SelectItem value="russian">Russian</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.language && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.language.message}
                </p>
              )}
            </div>

            <div className="flex justify-end pt-4">
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
