// pages/instructor_register/step3.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  courseProposalSchema,
  CourseProposalFormData,
} from '@/lib/form-schema';
import { useFormContext } from '@/lib/form-context';
import { useRouter } from 'next/navigation';
import CourseProposalStep from '@/components/courseProposalStep';

export default function Step3({
  onNext,
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  const router = useRouter();
  const { courseProposal, setCourseProposal } = useFormContext();

  const form = useForm<CourseProposalFormData>({
    resolver: zodResolver(courseProposalSchema),
    defaultValues: courseProposal,
  });

  const onSubmit = async (data: CourseProposalFormData) => {
    setCourseProposal(data);

    // Submit all form data to backend if needed here
    // const { personalInfo, professionalExp } = useFormContext();
    // await submitApplication({ ...personalInfo, ...professionalExp, ...data });

    onNext();
  };

  return (
    <CourseProposalStep
      form={form}
      onSubmit={form.handleSubmit(onSubmit)}
      isSubmitting={form.formState.isSubmitting}
      onBack={() => router.push('/instructor_register/step2')}
    />
  );
}
