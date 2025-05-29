"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import type { PersonalInfoFormData, ProfessionalExpFormData, CourseProposalFormData } from "./form-schema"

type FormContextType = {
  personalInfo: Partial<PersonalInfoFormData>
  professionalExp: Partial<ProfessionalExpFormData>
  courseProposal: Partial<CourseProposalFormData>
  setPersonalInfo: (data: Partial<PersonalInfoFormData>) => void
  setProfessionalExp: (data: Partial<ProfessionalExpFormData>) => void
  setCourseProposal: (data: Partial<CourseProposalFormData>) => void
  resetForm: () => void
}

const FormContext = createContext<FormContextType | undefined>(undefined)

export function FormProvider({ children }: { children: React.ReactNode }) {
  const [personalInfo, setPersonalInfoState] = useState<Partial<PersonalInfoFormData>>({})
  const [professionalExp, setProfessionalExpState] = useState<Partial<ProfessionalExpFormData>>({})
  const [courseProposal, setCourseProposalState] = useState<Partial<CourseProposalFormData>>({})

  // Load data from localStorage on initial render
  useEffect(() => {
    try {
      const savedData = localStorage.getItem("instructor-form-storage")
      if (savedData) {
        const parsedData = JSON.parse(savedData)
        setPersonalInfoState(parsedData.personalInfo || {})
        setProfessionalExpState(parsedData.professionalExp || {})
        setCourseProposalState(parsedData.courseProposal || {})
      }
    } catch (error) {
      console.error("Error loading form data:", error)
    }
  }, [])

  // Save to localStorage whenever data changes
  useEffect(() => {
    try {
      localStorage.setItem(
        "instructor-form-storage",
        JSON.stringify({
          personalInfo,
          professionalExp,
          courseProposal,
        }),
      )
    } catch (error) {
      console.error("Error saving form data:", error)
    }
  }, [personalInfo, professionalExp, courseProposal])

  const setPersonalInfo = (data: Partial<PersonalInfoFormData>) => {
    setPersonalInfoState((prev) => ({ ...prev, ...data }))
  }

  const setProfessionalExp = (data: Partial<ProfessionalExpFormData>) => {
    setProfessionalExpState((prev) => ({ ...prev, ...data }))
  }

  const setCourseProposal = (data: Partial<CourseProposalFormData>) => {
    setCourseProposalState((prev) => ({ ...prev, ...data }))
  }

  const resetForm = () => {
    setPersonalInfoState({})
    setProfessionalExpState({})
    setCourseProposalState({})
    localStorage.removeItem("instructor-form-storage")
  }

  return (
    <FormContext.Provider
      value={{
        personalInfo,
        professionalExp,
        courseProposal,
        setPersonalInfo,
        setProfessionalExp,
        setCourseProposal,
        resetForm,
      }}
    >
      {children}
    </FormContext.Provider>
  )
}

export function useFormContext() {
  const context = useContext(FormContext)
  if (context === undefined) {
    throw new Error("useFormContext must be used within a FormProvider")
  }
  return context
}
