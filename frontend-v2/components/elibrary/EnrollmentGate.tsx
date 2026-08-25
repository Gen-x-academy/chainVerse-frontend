import type { ReactNode } from "react"

export type EnrollmentState = "loading" | "active" | "pending" | "unenrolled" | "ended"

interface EnrollmentGateProps {
  state: EnrollmentState
  isTutor?: boolean
  children: ReactNode
}

const MESSAGE: Record<Exclude<EnrollmentState, "active">, string> = {
  loading: "Checking your enrollment…",
  pending: "Your enrollment is pending approval for this course.",
  unenrolled: "You must be enrolled in this course to view its reading list.",
  ended: "This course has ended and the reading list is no longer accessible.",
}

/**
 * Gates course reading-list content on enrollment state so protected data
 * never renders before authorization resolves. Tutors keep access regardless
 * of enrollment state.
 */
export function EnrollmentGate({ state, isTutor, children }: EnrollmentGateProps) {
  if (isTutor || state === "active") {
    return <>{children}</>
  }

  return (
    <div className="flex items-center justify-center rounded-lg border p-8 text-center text-sm text-muted-foreground">
      {MESSAGE[state]}
    </div>
  )
}
