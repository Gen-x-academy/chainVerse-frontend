"use client";

import { Badge } from "@/components/ui/badge";
import type {
  ScholarshipStatus,
  ApplicationStatus,
  PaymentStatus,
} from "@/types/scholarship.types";
import { cn } from "@/lib/utils";

// ─── Program status ───────────────────────────────────────────────────────────

const programStatusStyles: Record<ScholarshipStatus, string> = {
  draft:      "bg-gray-100 text-gray-700 hover:bg-gray-100",
  open:       "bg-green-100 text-green-700 hover:bg-green-100",
  closed:     "bg-orange-100 text-orange-700 hover:bg-orange-100",
  awarded:    "bg-blue-100 text-blue-700 hover:bg-blue-100",
  cancelled:  "bg-red-100 text-red-700 hover:bg-red-100",
};

export function ProgramStatusBadge({
  status,
  className,
}: {
  status: ScholarshipStatus;
  className?: string;
}) {
  return (
    <Badge className={cn(programStatusStyles[status], className)}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

// ─── Application status ───────────────────────────────────────────────────────

const appStatusStyles: Record<ApplicationStatus, string> = {
  draft:        "bg-gray-100 text-gray-700 hover:bg-gray-100",
  submitted:    "bg-blue-100 text-blue-700 hover:bg-blue-100",
  under_review: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
  shortlisted:  "bg-purple-100 text-purple-700 hover:bg-purple-100",
  approved:     "bg-green-100 text-green-700 hover:bg-green-100",
  rejected:     "bg-red-100 text-red-700 hover:bg-red-100",
  disbursed:    "bg-teal-100 text-teal-700 hover:bg-teal-100",
};

const appStatusLabels: Record<ApplicationStatus, string> = {
  draft:        "Draft",
  submitted:    "Submitted",
  under_review: "Under Review",
  shortlisted:  "Shortlisted",
  approved:     "Approved",
  rejected:     "Rejected",
  disbursed:    "Disbursed",
};

export function ApplicationStatusBadge({
  status,
  className,
}: {
  status: ApplicationStatus;
  className?: string;
}) {
  return (
    <Badge className={cn(appStatusStyles[status], className)}>
      {appStatusLabels[status]}
    </Badge>
  );
}

// ─── Payment status ───────────────────────────────────────────────────────────

const paymentStatusStyles: Record<PaymentStatus, string> = {
  pending:    "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
  processing: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  paid:       "bg-green-100 text-green-700 hover:bg-green-100",
  failed:     "bg-red-100 text-red-700 hover:bg-red-100",
};

export function PaymentStatusBadge({
  status,
  className,
}: {
  status: PaymentStatus;
  className?: string;
}) {
  return (
    <Badge className={cn(paymentStatusStyles[status], className)}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}
