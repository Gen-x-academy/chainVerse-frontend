import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("bg-accent animate-pulse rounded-md", className)}
      {...props}
    />
  )
}

type WorkspaceListSkeletonProps = React.ComponentProps<"div"> & {
  /** Number of placeholder rows to render. */
  rows?: number
  /** Accessible label announced to assistive technology while loading. */
  label?: string
}

function WorkspaceListSkeleton({
  rows = 5,
  label = "Loading list",
  className,
  ...props
}: WorkspaceListSkeletonProps) {
  const safeRows = Math.max(1, Math.min(rows, 20))
  return (
    <div
      data-slot="workspace-list-skeleton"
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: safeRows }).map((_, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 rounded-lg border p-4"
        >
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

type WorkspaceDetailSkeletonProps = React.ComponentProps<"div"> & {
  /** Accessible label announced to assistive technology while loading. */
  label?: string
}

function WorkspaceDetailSkeleton({
  label = "Loading details",
  className,
  ...props
}: WorkspaceDetailSkeletonProps) {
  return (
    <div
      data-slot="workspace-detail-skeleton"
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      <span className="sr-only">{label}</span>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex flex-col gap-2 rounded-lg border p-4">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  )
}

type WorkspaceEmptyStateProps = React.ComponentProps<"div"> & {
  /** Short heading describing the empty state. */
  title: string
  /** Optional supporting description. */
  description?: string
  /** Optional call-to-action rendered below the description. */
  action?: React.ReactNode
  /** Optional icon or illustration rendered above the heading. */
  icon?: React.ReactNode
}

function WorkspaceEmptyState({
  title,
  description,
  action,
  icon,
  className,
  children,
  ...props
}: WorkspaceEmptyStateProps) {
  return (
    <div
      data-slot="workspace-empty-state"
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center",
        className
      )}
      {...props}
    >
      {icon ? (
        <div aria-hidden="true" className="text-muted-foreground">
          {icon}
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <p className="text-base font-medium">{title}</p>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  )
}

export {
  Skeleton,
  WorkspaceListSkeleton,
  WorkspaceDetailSkeleton,
  WorkspaceEmptyState,
}