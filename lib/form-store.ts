// import { create } from "zustand"
// import { persist } from "zustand/middleware"
// import type { PersonalInfoFormData, ProfessionalExpFormData, CourseProposalFormData } from "./form-schema"

// interface FormState {
//   personalInfo: Partial<PersonalInfoFormData>
//   professionalExp: Partial<ProfessionalExpFormData>
//   courseProposal: Partial<CourseProposalFormData>
//   setPersonalInfo: (data: Partial<PersonalInfoFormData>) => void
//   setProfessionalExp: (data: Partial<ProfessionalExpFormData>) => void
//   setCourseProposal: (data: Partial<CourseProposalFormData>) => void
//   resetForm: () => void
// }

// export const useFormStore = create<FormState>()(
//   persist(
//     (set: any) => ({
//       personalInfo: {},
//       professionalExp: {},
//       courseProposal: {},
//       setPersonalInfo: (data) => set((state) => ({ personalInfo: { ...state.personalInfo, ...data } })),
//       setProfessionalExp: (data) => set((state) => ({ professionalExp: { ...state.professionalExp, ...data } })),
//       setCourseProposal: (data) => set((state) => ({ courseProposal: { ...state.courseProposal, ...data } })),
//       resetForm: () => set({ personalInfo: {}, professionalExp: {}, courseProposal: {} }),
//     }),
//     {
//       name: "instructor-form-storage",
//     },
//   ),
// )
