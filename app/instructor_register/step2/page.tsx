"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  professionalExpSchema,
  ProfessionalExpFormData,
} from "@/lib/form-schema";
import { useFormContext } from "@/lib/form-context";
import ProfessionalExperienceStep from "@/components/professionalExperienceStep";
import { useRouter } from "next/router";

export default function Step2({
  onNext,
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  const { professionalExp, setProfessionalExp } = useFormContext();
  const router = useRouter();

  const form = useForm<ProfessionalExpFormData>({
    resolver: zodResolver(professionalExpSchema),
    defaultValues: professionalExp,
  });

  const onSubmit = (data: ProfessionalExpFormData) => {
    setProfessionalExp(data);
    onNext();
  };

  return (
    <ProfessionalExperienceStep
      form={form}
      onSubmit={form.handleSubmit(onSubmit)}
      onBack={() => router.push("/instructor_register/step1")}
      isSubmitting={form.formState.isSubmitting}
    />
  );
}
