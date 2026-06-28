'use client';
import { useState } from 'react';
import { FormProvider } from '@/lib/form-context';
import PersonalInfoStep from '@/components/personalInfoStep';
import ProfessionalExperienceStep from '@/components/professionalExperienceStep';
import CourseProposalStep from '@/components/courseProposalStep';
// import SuccessPageStep from "@/components/successPageStep";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  personalInfoSchema,
  professionalExpSchema,
  courseProposalSchema,
  type PersonalInfoFormData,
  type ProfessionalExpFormData,
  type CourseProposalFormData,
} from '@/lib/form-schema';
import { useFormContext } from '@/lib/form-context';
import SuccessPageStep from './instructor_form_stepper/Success';

interface InstructorRegistrationFormProps {
  onComplete?: () => void;
  initialStep?: number;
  className?: string;
  showHeader?: boolean;
}

export function InstructorRegistrationForm({
  onComplete,
  initialStep = 1,
  className = '',
  showHeader = true,
}: InstructorRegistrationFormProps) {
  const [step, setStep] = useState(initialStep);

  const next = () => setStep(step + 1);
  const prev = () => setStep(step - 1);

  const handleComplete = () => {
    if (onComplete) {
      onComplete();
    }
  };

  return (
    <div className={`${className}`}>
      <FormProvider>
        {step === 1 && <Step1Form onNext={next} />}
        {step === 2 && <Step2Form onNext={next} onBack={prev} />}
        {step === 3 && <Step3Form onNext={next} onBack={prev} />}
        {step === 4 && <Step4Success />}
      </FormProvider>
    </div>
  );
}

// Step 1: Personal Information
function Step1Form({ onNext }: { onNext: () => void }) {
  const { personalInfo, setPersonalInfo } = useFormContext();

  const form = useForm<PersonalInfoFormData>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: personalInfo || {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      location: '',
      language: '',
    },
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

// Step 2: Professional Experience
function Step2Form({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  const { professionalExp, setProfessionalExp } = useFormContext();

  const form = useForm<ProfessionalExpFormData>({
    resolver: zodResolver(professionalExpSchema),
    defaultValues: professionalExp || {
      expertise: '',
      experience: '',
      currentRole: '',
      biography: '',
      linkedin: '',
    },
  });

  const onSubmit = (data: ProfessionalExpFormData) => {
    setProfessionalExp(data);
    onNext();
  };

  return (
    <ProfessionalExperienceStep
      form={form}
      onSubmit={form.handleSubmit(onSubmit)}
      onBack={onBack}
      isSubmitting={form.formState.isSubmitting}
    />
  );
}

// Step 3: Course Proposal
function Step3Form({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  const { courseProposal, setCourseProposal } = useFormContext();

  const form = useForm<CourseProposalFormData>({
    resolver: zodResolver(courseProposalSchema),
    defaultValues: courseProposal || {
      courseTitle: '',
      courseDescription: '',
      courseLevel: '',
      courseOutline: '',
    },
  });

  const onSubmit = async (data: CourseProposalFormData) => {
    setCourseProposal(data);

    // Here you would typically submit all form data to your backend

    onNext();
  };

  return (
    <CourseProposalStep
      form={form}
      onSubmit={form.handleSubmit(onSubmit)}
      onBack={onBack}
      isSubmitting={form.formState.isSubmitting}
    />
  );
}

// Step 4: Success Page
function Step4Success() {
  return <SuccessPageStep />;
}
