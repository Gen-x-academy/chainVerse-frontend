"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { personalInfoSchema, PersonalInfoFormData } from "@/lib/form-schema";
import { useFormContext } from "@/lib/form-context";
import PersonalInfoStep from "@/components/personalInfoStep";

export default function Step1({ onNext }: { onNext: () => void }) {
  const { personalInfo, setPersonalInfo } = useFormContext();

  const form = useForm<PersonalInfoFormData>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: personalInfo,
  });

  const onSubmit = (data: PersonalInfoFormData) => {
    setPersonalInfo(data);
    onNext();
  };

  return (
    <PersonalInfoStep
      form={form}
      onSubmit={form.handleSubmit(onSubmit)}
      isSubmitting={form.formState.isSubmitting}
    />
  );
}
