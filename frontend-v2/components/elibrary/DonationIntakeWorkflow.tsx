"use client";

import React, { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  BookCondition,
  CatalogMatch,
  DonationAcceptanceStatus,
  DonorContact,
  DonorPreferences,
  LocationNode,
  LocationSelection,
} from "@/src/features/library/types/library.types";
import { LocationHierarchySelector } from "./LocationHierarchySelector";

export type DonationIntakeStep = "donor" | "book" | "matching" | "decision" | "success";

export interface DonationIntakeWorkflowProps {
  isLoading?: boolean;
  error?: string | null;
  matches?: CatalogMatch[];
  matchesLoading?: boolean;
  matchesError?: string | null;
  canViewDonorDetails?: boolean;
  locationNodes?: LocationNode[];
  onSearchMatches?: (query: { isbn?: string; title?: string; author?: string }) => void;
  onSubmit?: (payload: {
    donor: DonorContact;
    preferences: DonorPreferences;
    title: string;
    author: string;
    isbn?: string;
    condition: BookCondition;
    conditionNotes?: string;
    matchedCatalogId?: string;
    location?: LocationSelection;
    status: DonationAcceptanceStatus;
    rejectionReason?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  className?: string;
}

const STEPS: DonationIntakeStep[] = ["donor", "book", "matching", "decision"];
const CONDITION_OPTIONS: BookCondition[] = ["good", "worn", "damaged", "unusable"];

const DEFAULT_PREFERENCES: DonorPreferences = {
  anonymous: false,
  acknowledgmentLetter: true,
  taxReceipt: false,
  returnIfRejected: true,
};

function StepIndicator({ current }: { current: DonationIntakeStep }) {
  if (current === "success") return null;
  const idx = STEPS.indexOf(current);
  return (
    <ol className="flex flex-wrap gap-2 text-xs" aria-label="Intake progress">
      {STEPS.map((step, i) => (
        <li
          key={step}
          className={cn(
            "rounded-full px-3 py-1 capitalize",
            i <= idx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}
        >
          {step}
        </li>
      ))}
    </ol>
  );
}

/** #931: Multi-step donated-book intake with catalog matching and donor privacy. */
export function DonationIntakeWorkflow({
  isLoading,
  error,
  matches = [],
  matchesLoading,
  matchesError,
  canViewDonorDetails = true,
  locationNodes = [],
  onSearchMatches,
  onSubmit,
  className,
}: DonationIntakeWorkflowProps) {
  const [step, setStep] = useState<DonationIntakeStep>("donor");
  const [donor, setDonor] = useState<DonorContact>({ name: "", email: "" });
  const [preferences, setPreferences] = useState<DonorPreferences>(DEFAULT_PREFERENCES);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [isbn, setIsbn] = useState("");
  const [condition, setCondition] = useState<BookCondition>("good");
  const [conditionNotes, setConditionNotes] = useState("");
  const [selectedMatchId, setSelectedMatchId] = useState<string | undefined>();
  const [location, setLocation] = useState<LocationSelection>({});
  const [acceptance, setAcceptance] = useState<DonationAcceptanceStatus>("pending");
  const [rejectionReason, setRejectionReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [intakeId, setIntakeId] = useState<string | null>(null);

  const handleSearchMatches = useCallback(() => {
    onSearchMatches?.({ isbn: isbn || undefined, title, author });
  }, [onSearchMatches, isbn, title, author]);

  const handleSubmit = useCallback(async () => {
    if (!onSubmit) return;
    if (acceptance === "rejected" && !rejectionReason.trim()) {
      setSubmitError("A rejection reason is required.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await onSubmit({
        donor,
        preferences,
        title,
        author,
        isbn: isbn || undefined,
        condition,
        conditionNotes: conditionNotes || undefined,
        matchedCatalogId: selectedMatchId,
        location: acceptance === "accepted" ? location : undefined,
        status: acceptance,
        rejectionReason: acceptance === "rejected" ? rejectionReason : undefined,
      });
      if (result.success) {
        setIntakeId(`DON-${Date.now()}`);
        setStep("success");
      } else {
        setSubmitError(result.error ?? "Failed to submit intake.");
      }
    } catch {
      setSubmitError("Failed to submit intake.");
    } finally {
      setSubmitting(false);
    }
  }, [
    onSubmit,
    donor,
    preferences,
    title,
    author,
    isbn,
    condition,
    conditionNotes,
    selectedMatchId,
    location,
    acceptance,
    rejectionReason,
  ]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3" role="status" aria-label="Loading donation intake">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="h-40 rounded-lg border bg-muted" />
        <span className="sr-only">Loading donation intake...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="font-medium text-destructive">Error loading donation intake</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (step === "success") {
    return (
      <Card className={className} role="status">
        <CardHeader>
          <CardTitle>Donation intake recorded</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Reference: {intakeId}</p>
          <p>
            <strong>{title}</strong> — {acceptance}
          </p>
          {preferences.anonymous ? (
            <p className="text-muted-foreground">Donor identity is protected (anonymous donation).</p>
          ) : canViewDonorDetails ? (
            <p className="text-muted-foreground">Donor: {donor.name}</p>
          ) : (
            <p className="text-muted-foreground">Donor details are restricted to acquisitions staff.</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <StepIndicator current={step} />

      {step === "donor" && (
        <Card>
          <CardHeader>
            <CardTitle>Donor information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={preferences.anonymous}
                onChange={(e) => setPreferences((p) => ({ ...p, anonymous: e.target.checked }))}
              />
              Anonymous donation (hide donor from non-acquisitions staff)
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Donor name
                <input
                  aria-label="Donor name"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={donor.name}
                  onChange={(e) => setDonor((d) => ({ ...d, name: e.target.value }))}
                  disabled={preferences.anonymous && !canViewDonorDetails}
                />
              </label>
              <label className="text-sm">
                Donor email (staff only)
                <input
                  aria-label="Donor email"
                  type="email"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={donor.email}
                  onChange={(e) => setDonor((d) => ({ ...d, email: e.target.value }))}
                />
              </label>
            </div>
            <fieldset className="space-y-2 text-sm">
              <legend className="font-medium">Donor preferences</legend>
              {(
                [
                  ["acknowledgmentLetter", "Send acknowledgment letter"],
                  ["taxReceipt", "Issue tax receipt"],
                  ["returnIfRejected", "Return item if rejected"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={preferences[key]}
                    onChange={(e) => setPreferences((p) => ({ ...p, [key]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <Button onClick={() => setStep("book")} disabled={!donor.name.trim()}>
              Continue to book details
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "book" && (
        <Card>
          <CardHeader>
            <CardTitle>Book details &amp; condition</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Title
                <input
                  aria-label="Book title"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label className="text-sm">
                Author
                <input
                  aria-label="Book author"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                />
              </label>
              <label className="text-sm sm:col-span-2">
                ISBN (optional)
                <input
                  aria-label="ISBN"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                />
              </label>
            </div>
            <fieldset>
              <legend className="text-sm font-medium">Condition assessment</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {CONDITION_OPTIONS.map((c) => (
                  <Button
                    key={c}
                    type="button"
                    size="sm"
                    variant={condition === c ? "default" : "outline"}
                    onClick={() => setCondition(c)}
                  >
                    {c}
                  </Button>
                ))}
              </div>
            </fieldset>
            <label className="text-sm block">
              Condition notes
              <textarea
                aria-label="Condition notes"
                className="mt-1 w-full rounded border px-3 py-2"
                rows={2}
                value={conditionNotes}
                onChange={(e) => setConditionNotes(e.target.value)}
              />
            </label>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("donor")}>
                Back
              </Button>
              <Button
                onClick={() => {
                  handleSearchMatches();
                  setStep("matching");
                }}
                disabled={!title.trim() || !author.trim()}
              >
                Search catalog matches
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "matching" && (
        <Card>
          <CardHeader>
            <CardTitle>Catalog matching</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Review potential matches before creating a new bibliographic record.
            </p>
            {matchesLoading && (
              <p role="status" className="text-sm">
                Searching catalog...
              </p>
            )}
            {matchesError && (
              <div role="alert" className="text-sm text-destructive">
                {matchesError}
              </div>
            )}
            {!matchesLoading && !matchesError && matches.length === 0 && (
              <p role="status" className="text-sm text-muted-foreground">
                No catalog matches found. A new record will be created on acceptance.
              </p>
            )}
            <ul className="space-y-2">
              {matches.map((m) => (
                <li key={m.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded border p-3 text-sm hover:bg-muted/50">
                    <input
                      type="radio"
                      name="catalog-match"
                      checked={selectedMatchId === m.id}
                      onChange={() => setSelectedMatchId(m.id)}
                    />
                    <span>
                      <span className="font-medium">{m.title}</span> by {m.author}
                      {m.isbn && <span className="text-muted-foreground"> · ISBN {m.isbn}</span>}
                      <span className="block text-xs text-muted-foreground">
                        {Math.round(m.matchScore * 100)}% match · {m.existingCopies} existing copies
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="catalog-match"
                checked={selectedMatchId === undefined}
                onChange={() => setSelectedMatchId(undefined)}
              />
              Create as new bibliographic record
            </label>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("book")}>
                Back
              </Button>
              <Button onClick={() => setStep("decision")}>Continue to decision</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "decision" && (
        <Card>
          <CardHeader>
            <CardTitle>Acceptance decision</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <fieldset>
              <legend className="text-sm font-medium">Status</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["accepted", "rejected", "pending"] as DonationAcceptanceStatus[]).map((s) => (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant={acceptance === s ? "default" : "outline"}
                    onClick={() => setAcceptance(s)}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </fieldset>
            {acceptance === "rejected" && (
              <label className="text-sm block">
                Rejection reason (required)
                <textarea
                  aria-label="Rejection reason"
                  className="mt-1 w-full rounded border px-3 py-2"
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  required
                />
              </label>
            )}
            {acceptance === "accepted" && locationNodes.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Shelving location</p>
                <LocationHierarchySelector
                  nodes={locationNodes}
                  selection={location}
                  onChange={setLocation}
                />
              </div>
            )}
            {submitError && (
              <div role="alert" className="text-sm text-destructive">
                {submitError}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("matching")}>
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Submitting..." : "Submit intake"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
