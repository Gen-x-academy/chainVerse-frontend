"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, AlertCircle, CheckCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type LostItemStatus = "found" | "paid" | "replaced" | "waived" | "disputed";

interface ActivityLog {
  id: string;
  action: string;
  user: string;
  timestamp: string;
  notes?: string;
}

interface LostItemResolutionProps {
  itemTitle: string;
  replacementCost: number;
  status: LostItemStatus;
  patronName?: string;
  activityHistory: ActivityLog[];
  isLoading?: boolean;
  error?: string;
  success?: string;
  onResolve: (status: LostItemStatus, notes: string) => Promise<void>;
  requiresNotesForStatus: LostItemStatus[];
  patronConsequences: Record<LostItemStatus, string[]>;
}

const STATUS_LABELS: Record<LostItemStatus, string> = {
  found: "Found",
  paid: "Paid",
  replaced: "Replaced",
  waived: "Waived",
  disputed: "Disputed",
};

const STATUS_VARIANTS: Record<LostItemStatus, string> = {
  found: "bg-green-100 text-green-800",
  paid: "bg-blue-100 text-blue-800",
  replaced: "bg-purple-100 text-purple-800",
  waived: "bg-gray-100 text-gray-800",
  disputed: "bg-red-100 text-red-800",
};

/** #976: Show a lost item's replacement charge and let librarians pick a resolution.
 * Enhanced to include notes requirement, patron consequences, and activity history.
 */
export function LostItemResolution({
  itemTitle,
  replacementCost,
  status: initialStatus,
  patronName,
  activityHistory: initialHistory,
  isLoading = false,
  error = "",
  success = "",
  onResolve,
  requiresNotesForStatus,
  patronConsequences,
}: LostItemResolutionProps) {
  const [selectedStatus, setSelectedStatus] = useState<LostItemStatus>(initialStatus);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConsequences, setShowConsequences] = useState(false);
  const [activityHistory, setActivityHistory] = useState<ActivityLog[]>(initialHistory);
  const [currentStatus, setCurrentStatus] = useState<LostItemStatus>(initialStatus);

  const options: LostItemStatus[] = ["found", "paid", "replaced", "waived", "disputed"];
  const notesRequired = requiresNotesForStatus.includes(selectedStatus) && selectedStatus !== currentStatus;
  const hasConsequences = patronConsequences[selectedStatus]?.length > 0 && selectedStatus !== currentStatus;
  const notesMissing = notesRequired && !notes.trim();

  const handleSubmit = async () => {
    if (notesMissing) return;

    // Show consequences if there are any and we haven't shown the confirmation yet
    if (hasConsequences && !showConsequences) {
      setShowConsequences(true);
      return;
    }

    setIsSubmitting(true);
    await onResolve(selectedStatus, notes);

    // Update local state
    const newActivity: ActivityLog = {
      id: Date.now().toString(),
      action: `Status updated to ${STATUS_LABELS[selectedStatus]}`,
      user: "Current Librarian",
      timestamp: new Date().toISOString(),
      notes: notes,
    };
    
    setActivityHistory((prev) => [...prev, newActivity]);
    setCurrentStatus(selectedStatus);
    setNotes("");
    setShowConsequences(false);
    setIsSubmitting(false);
  };

  const confirmSubmission = async () => {
    setIsSubmitting(true);
    await onResolve(selectedStatus, notes);
    
    const newActivity: ActivityLog = {
      id: Date.now().toString(),
      action: `Status updated to ${STATUS_LABELS[selectedStatus]}`,
      user: "Current Librarian",
      timestamp: new Date().toISOString(),
      notes: notes,
    };
    
    setActivityHistory((prev) => [...prev, newActivity]);
    setCurrentStatus(selectedStatus);
    setNotes("");
    setShowConsequences(false);
    setIsSubmitting(false);
  };

  const cancelSubmission = () => {
    setSelectedStatus(currentStatus);
    setNotes("");
    setShowConsequences(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {success && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle>{itemTitle}</CardTitle>
            <Badge className={cn("w-fit", STATUS_VARIANTS[currentStatus])}>
              {STATUS_LABELS[currentStatus]}
            </Badge>
          </div>
          {patronName && (
            <p className="text-sm text-muted-foreground">Responsible patron: {patronName}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm">Replacement cost: <span className="font-medium">${replacementCost.toFixed(2)}</span></p>
          </div>

          {/* Status Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Update Resolution Status</label>
            <div className="flex flex-wrap gap-2">
              {options.map((option) => (
                <Button
                  key={option}
                  variant={option === selectedStatus ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedStatus(option)}
                  disabled={isSubmitting}
                  className={cn(
                    option === currentStatus && "ring-2 ring-offset-2 ring-gray-400"
                  )}
                >
                  {STATUS_LABELS[option]}
                </Button>
              ))}
            </div>
          </div>

          {/* Notes Section */}
          {selectedStatus !== currentStatus && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Notes
                {notesRequired && <span className="text-red-500 ml-1">*</span>}
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this resolution..."
                className="min-h-[100px]"
                disabled={isSubmitting}
              />
              {notesMissing && (
                <p className="text-sm text-red-500">Notes are required to change to this status.</p>
              )}
            </div>
          )}

          {/* Patron Consequences Confirmation */}
          {showConsequences && hasConsequences && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-amber-800">Patron Consequences for this Status Change</h4>
              <ul className="list-disc list-inside space-y-1">
                {patronConsequences[selectedStatus].map((consequence, index) => (
                  <li key={index} className="text-sm text-amber-700">{consequence}</li>
                ))}
              </ul>
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button variant="secondary" onClick={cancelSubmission} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button onClick={confirmSubmission} disabled={isSubmitting || notesMissing}>
                  {isSubmitting ? "Updating..." : "Confirm and Apply"}
                </Button>
              </div>
            </div>
          )}

          {/* Submit Button */}
          {!showConsequences && selectedStatus !== currentStatus && (
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="secondary" onClick={cancelSubmission} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting || notesMissing}
                className="w-full sm:w-auto"
              >
                {isSubmitting ? "Updating..." : hasConsequences ? "Review Consequences" : "Update Status"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity History Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resolution History</CardTitle>
        </CardHeader>
        <CardContent>
          {activityHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-4">
              {activityHistory.map((activity) => (
                <li key={activity.id} className="flex gap-3 pb-4 border-b last:border-0">
                  <Calendar className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{activity.action}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(activity.timestamp).toLocaleString()} by {activity.user}
                    </p>
                    {activity.notes && (
                      <p className="text-sm text-gray-600 mt-1">{activity.notes}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}