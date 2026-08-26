"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, X, Calendar, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ItemCondition = "good" | "worn" | "damaged" | "lost" | "in-repair";
export type RepairStatus = "not-needed" | "scheduled" | "in-progress" | "completed" | "unrepairable";

export interface EvidenceAttachment {
  id: string;
  name: string;
  type: string;
  url: string;
  uploadedAt: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  user: string;
  timestamp: string;
  notes?: string;
}

export interface ConditionReport {
  itemId: string;
  title: string;
  currentCondition: ItemCondition;
  repairStatus: RepairStatus;
  notes: string;
  evidence: EvidenceAttachment[];
  activityHistory: ActivityLog[];
  patronId?: string;
  patronName?: string;
}

interface ItemConditionReportProps {
  report: ConditionReport;
  isLoading?: boolean;
  error?: string;
  success?: string;
  onSubmit: (updates: Partial<ConditionReport>) => Promise<void>;
  requiresNotesForStatus: ItemCondition[];
  patronConsequences: Record<ItemCondition, string[]>;
}

const CONDITION_LABELS: Record<ItemCondition, string> = {
  good: "Good",
  worn: "Worn",
  damaged: "Damaged",
  lost: "Lost",
  "in-repair": "In Repair",
};

const REPAIR_STATUS_LABELS: Record<RepairStatus, string> = {
  "not-needed": "No Repair Needed",
  scheduled: "Scheduled",
  "in-progress": "In Progress",
  completed: "Completed",
  unrepairable: "Unrepairable",
};

export function ItemConditionReport({
  report: initialReport,
  isLoading = false,
  error = "",
  success = "",
  onSubmit,
  requiresNotesForStatus,
  patronConsequences,
}: ItemConditionReportProps) {
  const [report, setReport] = useState<ConditionReport>(initialReport);
  const [newNotes, setNewNotes] = useState("");
  const [newCondition, setNewCondition] = useState<ItemCondition>(initialReport.currentCondition);
  const [newRepairStatus, setNewRepairStatus] = useState<RepairStatus>(initialReport.repairStatus);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConsequences, setShowConsequences] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<Partial<ConditionReport> | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const showConfirmDialog = requiresNotesForStatus.includes(newCondition) && !newNotes.trim();
  const hasConsequences = patronConsequences[newCondition]?.length > 0;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    // Simulate file upload
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    const newEvidence: EvidenceAttachment = {
      id: Date.now().toString(),
      name: file.name,
      type: file.type,
      url: URL.createObjectURL(file),
      uploadedAt: new Date().toISOString(),
    };

    setReport((prev) => ({
      ...prev,
      evidence: [...prev.evidence, newEvidence],
    }));
    setUploadingFile(false);
  };

  const removeEvidence = (evidenceId: string) => {
    setReport((prev) => ({
      ...prev,
      evidence: prev.evidence.filter((e) => e.id !== evidenceId),
    }));
  };

  const confirmUpdate = async () => {
    if (!pendingUpdate) return;
    
    setIsSubmitting(true);
    await onSubmit({
      ...pendingUpdate,
      activityHistory: [
        ...report.activityHistory,
        {
          id: Date.now().toString(),
          action: `Status updated to ${CONDITION_LABELS[newCondition]}`,
          user: "Current Librarian",
          timestamp: new Date().toISOString(),
          notes: newNotes,
        },
      ],
    });
    
    setReport((prev) => ({
      ...prev,
      ...pendingUpdate,
      activityHistory: [
        ...prev.activityHistory,
        {
          id: Date.now().toString(),
          action: `Status updated to ${CONDITION_LABELS[newCondition]}`,
          user: "Current Librarian",
          timestamp: new Date().toISOString(),
          notes: newNotes,
        },
      ],
    }));
    
    setNewNotes("");
    setShowConsequences(false);
    setPendingUpdate(null);
    setIsSubmitting(false);
  };

  const handleSubmit = async () => {
    const updates: Partial<ConditionReport> = {
      currentCondition: newCondition,
      repairStatus: newRepairStatus,
      notes: report.notes + (newNotes ? `\n[${new Date().toLocaleString()}] ${newNotes}` : ""),
    };

    if (hasConsequences && !showConsequences) {
      setPendingUpdate(updates);
      setShowConsequences(true);
      return;
    }

    if (showConfirmDialog) {
      return; // Prevent submission if notes are required but missing
    }

    setIsSubmitting(true);
    await onSubmit(updates);
    
    // Update local state
    setReport((prev) => ({
      ...prev,
      ...updates,
      activityHistory: [
        ...prev.activityHistory,
        {
          id: Date.now().toString(),
          action: `Status updated to ${CONDITION_LABELS[newCondition]}`,
          user: "Current Librarian",
          timestamp: new Date().toISOString(),
          notes: newNotes,
        },
      ],
    }));
    
    setNewNotes("");
    setIsSubmitting(false);
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

  if (!report) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No report found</h3>
          <p className="text-sm text-gray-500 mt-1">The condition report for this item could not be loaded.</p>
        </CardContent>
      </Card>
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
          <div className="flex items-center justify-between">
            <CardTitle>{report.title}</CardTitle>
            <Badge variant="secondary" className={cn(
              report.currentCondition === "good" && "bg-green-100 text-green-800",
              report.currentCondition === "worn" && "bg-yellow-100 text-yellow-800",
              report.currentCondition === "damaged" && "bg-orange-100 text-orange-800",
              report.currentCondition === "lost" && "bg-red-100 text-red-800",
              report.currentCondition === "in-repair" && "bg-blue-100 text-blue-800",
            )}>
              {CONDITION_LABELS[report.currentCondition]}
            </Badge>
          </div>
          {report.patronName && (
            <p className="text-sm text-muted-foreground">Checked out by: {report.patronName}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Update Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Condition</label>
              <Select value={newCondition} onValueChange={(value: ItemCondition) => setNewCondition(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Repair Status</label>
              <Select value={newRepairStatus} onValueChange={(value: RepairStatus) => setNewRepairStatus(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select repair status" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(REPAIR_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Notes
              {requiresNotesForStatus.includes(newCondition) && (
                <span className="text-red-500 ml-1">*</span>
              )}
            </label>
            <Textarea
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="Add notes about this item's condition..."
              className="min-h-[100px]"
            />
            {showConfirmDialog && (
              <p className="text-sm text-red-500">Notes are required for this status change.</p>
            )}
          </div>

          {/* Evidence Attachment Section */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Evidence Attachments</label>
            <div className="border-2 border-dashed rounded-lg p-4 text-center">
              <Input
                type="file"
                id="file-upload"
                className="hidden"
                onChange={handleFileUpload}
                accept="image/*,.pdf"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="flex flex-col items-center">
                  <Upload className="h-8 w-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600">
                    {uploadingFile ? "Uploading..." : "Click to upload or drag and drop"}
                  </span>
                  <span className="text-xs text-gray-400 mt-1">PNG, JPG, PDF up to 10MB</span>
                </div>
              </label>
            </div>

            {/* List of attached evidence */}
            {report.evidence.length > 0 && (
              <ul className="space-y-2">
                {report.evidence.map((item) => (
                  <li key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">{item.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeEvidence(item.id)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Patron Consequences Warning */}
          {showConsequences && hasConsequences && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-amber-800">Patron Consequences for this Status Change</h4>
              <ul className="list-disc list-inside space-y-1">
                {patronConsequences[newCondition].map((consequence, index) => (
                  <li key={index} className="text-sm text-amber-700">{consequence}</li>
                ))}
              </ul>
              <div className="flex gap-2 pt-2">
                <Button variant="secondary" onClick={() => { setShowConsequences(false); setPendingUpdate(null); }}>
                  Cancel
                </Button>
                <Button onClick={confirmUpdate} disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Confirm and Apply"}
                </Button>
              </div>
            </div>
          )}

          {/* Submit Button */}
          {!showConsequences && (
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting || (requiresNotesForStatus.includes(newCondition) && !newNotes.trim())}
              className="w-full md:w-auto"
            >
              {isSubmitting ? "Updating..." : "Update Condition"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Activity History Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Activity History</CardTitle>
        </CardHeader>
        <CardContent>
          {report.activityHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-4">
              {report.activityHistory.map((activity) => (
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