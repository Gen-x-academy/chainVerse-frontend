"use client";

import { StepIndicator } from "@/components/step-indicator";
import { BackButton } from "@/components/back-button";
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
import { PersonalInfoFormData } from "@/lib/form-schema";
import { UseFormReturn } from "react-hook-form";
import Image from "next/image";
import Link from "next/link";

type Props = {
  form: UseFormReturn<PersonalInfoFormData>;
  onSubmit: () => void;
  isSubmitting: boolean;
};

export default function PersonalInfoStep({
  form,
  onSubmit,
  isSubmitting,
}: Props) {
  return (
    <div className="max-w-3xl mx-auto">
     
        
      <div className="sm:mx-auto flex flex-col justify-center items-center sm:w-full py-6 sm:max-w-md">
        <Link
              href="/"
              className="flex flex-col items-center gap-2 justify-center"
              aria-label="Home"
            >
          <Image
            className="mx-auto h-10 w-auto"
            src="/logo.png"
            alt="ChainVerse Academy"
            width={32}
            height={32}
          />
        <span className="text-xl font-medium  tracking-tight select-none">
                ChainVerse Academy
              </span>
              </Link>
        </div>
      <div className="bg-white rounded-lg border py-6 px-20 mt-4">
        <div className="text-center my-8">
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

        <div className="p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold">Personal Information</h2>
            <p className="text-muted-foreground text-sm">
              Tell us about yourself and your experience
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-6">
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
                onValueChange={(value) => form.setValue("language", value)}
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
