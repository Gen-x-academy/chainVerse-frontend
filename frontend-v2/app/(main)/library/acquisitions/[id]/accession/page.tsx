'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { LibraryAdminLayout } from '@/components/elibrary/LibraryAdminLayout';
import { AccessionForm } from '@/components/elibrary/AccessionForm';
import { acquisitionsService } from '@/src/features/library/services/acquisitions.service';
import type { AccessionCopy, PurchaseIntake } from '@/src/features/library/types/acquisitions.types';

/** #930: Accession form for a purchase intake */
export default function AccessionPage() {
  const params = useParams();
  const intakeId = params.id as string;

  const [intake, setIntake] = useState<(PurchaseIntake & { id: string }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    acquisitionsService.getIntake(intakeId)
      .then((data) => { if (!cancelled) setIntake(data); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [intakeId]);

  const handleSubmit = async (copies: AccessionCopy[]) => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);
    try {
      await acquisitionsService.submitAccession(intakeId, copies);
      setSuccessMessage('Accession completed. New holdings linked to catalog record.');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Accession failed');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <LibraryAdminLayout requiredPermission="acquisitions" activeHref="/library/acquisitions">
        <div aria-label="Loading accession form" className="py-12 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      </LibraryAdminLayout>
    );
  }

  if (error || !intake) {
    return (
      <LibraryAdminLayout requiredPermission="acquisitions" activeHref="/library/acquisitions">
        <div role="alert" className="rounded-md border border-destructive/30 p-6 text-sm text-destructive">
          {error ?? 'Intake not found'}
        </div>
      </LibraryAdminLayout>
    );
  }

  return (
    <LibraryAdminLayout requiredPermission="acquisitions" activeHref="/library/acquisitions">
      <div className="space-y-6">
        <div>
          <Link href="/library/acquisitions" className="text-sm text-indigo-600 hover:underline">
            ← Acquisitions
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Accession</h1>
        </div>
        <AccessionForm
          intakeTitle={intake.title}
          bookRecordId={intake.bookRecordId}
          onSubmit={handleSubmit}
          isLoading={isSubmitting}
          error={submitError}
          successMessage={successMessage}
        />
      </div>
    </LibraryAdminLayout>
  );
}
