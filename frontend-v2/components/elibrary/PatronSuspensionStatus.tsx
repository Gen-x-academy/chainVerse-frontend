import { cn } from "@/lib/utils"

export interface PatronSuspensionStatusProps {
  activeFines: number
  suspensionThreshold: number
  isSuspended: boolean
  className?: string
}

/**
 * #977: Shows a patron how close they are to a fine-based suspension,
 * and what to do to recover access if already suspended.
 */
export function PatronSuspensionStatus({
  activeFines,
  suspensionThreshold,
  isSuspended,
  className,
}: PatronSuspensionStatusProps) {
  const remaining = Math.max(suspensionThreshold - activeFines, 0)

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        isSuspended ? "border-destructive bg-destructive/10" : "border-border",
        className
      )}
    >
      {isSuspended ? (
        <>
          <p className="font-semibold text-destructive">
            Your account is suspended
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Outstanding fines (${activeFines.toFixed(2)}) exceed the $
            {suspensionThreshold.toFixed(2)} limit. Pay down your balance to
            below the threshold to restore borrowing and reading access.
          </p>
        </>
      ) : (
        <>
          <p className="font-medium">Account in good standing</p>
          <p className="mt-1 text-sm text-muted-foreground">
            ${remaining.toFixed(2)} in additional fines before your account is
            suspended.
          </p>
        </>
      )}
    </div>
  )
}
