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
  professionalExpSchema,
  type ProfessionalExpFormData,
} from "@/lib/form-schema";
import { useFormContext } from "@/lib/form-context";

export default function ProfessionalExperienceStep() {
  const router = useRouter();
  const { professionalExp, setProfessionalExp } = useFormContext();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ProfessionalExpFormData>({
    resolver: zodResolver(professionalExpSchema),
    defaultValues: {
      expertise: professionalExp.expertise || "",
      experience: professionalExp.experience || "",
      currentRole: professionalExp.currentRole || "",
      biography: professionalExp.biography || "",
      linkedin: professionalExp.linkedin || "",
    },
  });

  const onSubmit = async (data: ProfessionalExpFormData) => {
    setIsSubmitting(true);

    try {
      setProfessionalExp(data);
      router.push("/instructor_register/step3");
    } catch (error) {
      console.error("Error saving form data:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    // Save current form data before navigating back
    const currentValues = form.getValues();
    setProfessionalExp(currentValues);
    router.push("/instructor_register/step1");
  };

  return (
    <div className="max-w-3xl mx-auto">
      <BackButton href="/register/step1" label="Back to Personal Information" />

      <div className="bg-white rounded-lg border py-6 px-20 mt-4">
        <div className="text-center my-8">
          <h1 className="text-3xl font-bold">Become an Instructor</h1>
          <p className="text-muted-foreground mt-2">
            Share your blockchain expertise and earn cryptocurrency while
            teaching others
          </p>
        </div>

        {/* step indicator */}
        <div className="mt-20">
          <StepIndicator currentStep={2} totalSteps={3} />
        </div>

        <div className=" p-8 ">
          <div className="mb-6">
            <h2 className="text-xl font-semibold">Professional Experience</h2>
            <p className="text-muted-foreground text-sm">
              Tell us about yourself and your experience
            </p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="expertise">Primary Area of Expertise</Label>
              <Select
                onValueChange={(value) => form.setValue("expertise", value)}
                defaultValue={form.getValues("expertise")}
              >
                <SelectTrigger className="bg-[#FCFAF8]">
                  <SelectValue placeholder="Select your primary expertise" />
                </SelectTrigger>
                <SelectContent className="bg-[#fff]">
                  <SelectItem value="blockchain_fundamentals">
                    Blockchain Fundamentals
                  </SelectItem>
                  <SelectItem value="smart_contracts">
                    Smart Contracts
                  </SelectItem>
                  <SelectItem value="defi">
                    Decentralized Finance (DeFi)
                  </SelectItem>
                  <SelectItem value="nft">NFTs and Digital Assets</SelectItem>
                  <SelectItem value="crypto_trading">
                    Cryptocurrency Trading
                  </SelectItem>
                  <SelectItem value="web3">Web3 Development</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.expertise && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.expertise.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="experience">Years of Experience</Label>
              <Select
                onValueChange={(value) => form.setValue("experience", value)}
                defaultValue={form.getValues("experience")}
              >
                <SelectTrigger className="bg-[#FCFAF8]">
                  <SelectValue placeholder="Select your years of experience" />
                </SelectTrigger>
                <SelectContent className="bg-[#fff]">
                  <SelectItem value="0-2">0-2 years</SelectItem>
                  <SelectItem value="3-5">3-5 years</SelectItem>
                  <SelectItem value="6-10">6-10 years</SelectItem>
                  <SelectItem value="10+">10+ years</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.experience && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.experience.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="currentRole">Current Role</Label>
              <Input
                id="currentRole"
                {...form.register("currentRole")}
                placeholder="e.g. Blockchain Developer at XYZ Company"
                className={
                  form.formState.errors.currentRole
                    ? "border-destructive focus-visible:ring-destructive"
                    : "bg-[#FCFAF8]"
                }
              />
              {form.formState.errors.currentRole && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.currentRole.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="biography">Professional Biography</Label>
              <Textarea
                id="biography"
                {...form.register("biography")}
                placeholder="Tell us about your professional background and expertise"
                className={`min-h-[150px] ${
                  form.formState.errors.biography
                    ? "border-destructive focus-visible:ring-destructive"
                    : "bg-[#FCFAF8]"
                }`}
              />
              {form.formState.errors.biography && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.biography.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="linkedin">LinkedIn Profile</Label>
              <Input
                id="linkedin"
                {...form.register("linkedin")}
                placeholder="https://linkedin.com/in/yourprofile"
                className={
                  form.formState.errors.linkedin
                    ? "border-destructive focus-visible:ring-destructive"
                    : "bg-[#FCFAF8]"
                }
              />
              {form.formState.errors.linkedin && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.linkedin.message}
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
