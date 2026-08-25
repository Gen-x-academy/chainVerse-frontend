import { cn } from "@/lib/utils"

export type AvailabilityStatus = "physical" | "digital" | "hold" | "unavailable"

interface ItemAvailabilityStatusProps {
  status: AvailabilityStatus
  reason?: string
  onAction?: () => void
  className?: string
}

const STATUS_LABEL: Record<AvailabilityStatus, string> = {
  physical: "Available on shelf",
  digital: "Available digitally",
  hold: "On hold — join waitlist",
  unavailable: "Unavailable",
}

const STATUS_CLASS: Record<AvailabilityStatus, string> = {
  physical: "bg-green-100 text-green-700",
  digital: "bg-blue-100 text-blue-700",
  hold: "bg-yellow-100 text-yellow-700",
  unavailable: "bg-gray-100 text-gray-600",
}

/** Shows real-time availability for a reading-list item and links to the relevant action. */
export function ItemAvailabilityStatus({
  status,
  reason,
  onAction,
  className,
}: ItemAvailabilityStatusProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <button
        type="button"
        onClick={onAction}
        className={cn(
          "rounded-full px-3 py-1 text-xs font-medium",
          STATUS_CLASS[status]
        )}
      >
        {STATUS_LABEL[status]}
      </button>
      {status === "unavailable" && reason && (
        <span className="text-xs text-muted-foreground">{reason}</span>
      )}
    </div>
  )
}
