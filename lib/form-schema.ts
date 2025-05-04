import { z } from "zod";

// Step 1: Personal Information
export const personalInfoSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().optional(),
  location: z.string().min(2, "Please enter your location"),
  language: z.string().min(1, "Please select at least one language"),
});

// Step 2: Professional Experience
export const professionalExpSchema = z.object({
  expertise: z.string().min(1, "Please select your area of expertise"),
  experience: z.string().min(1, "Please select your years of experience"),
  currentRole: z.string().min(2, "Please enter your current role"),
  biography: z.string().min(10, "Biography must be at least 10 characters"),
  linkedin: z.string().url("Please enter a valid LinkedIn URL").optional(),
});

// Step 3: Course Proposal
export const courseProposalSchema = z.object({
  courseTitle: z.string().min(5, "Course title must be at least 5 characters"),
  courseDescription: z
    .string()
    .min(10, "Description must be at least 5 characters"),
  courseLevel: z.string().min(1, "Please select a course level"),
  courseOutline: z
    .string()
    .min(10, "Course outline must be at least 100 characters"),
});

// Combined schema for the entire form
export const instructorFormSchema = z.object({
  ...personalInfoSchema.shape,
  ...professionalExpSchema.shape,
  ...courseProposalSchema.shape,
});

export type PersonalInfoFormData = z.infer<typeof personalInfoSchema>;
export type ProfessionalExpFormData = z.infer<typeof professionalExpSchema>;
export type CourseProposalFormData = z.infer<typeof courseProposalSchema>;
export type InstructorFormData = z.infer<typeof instructorFormSchema>;
