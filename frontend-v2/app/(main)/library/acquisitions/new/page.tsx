'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LibraryAdminLayout } from '@/components/elibrary/LibraryAdminLayout';
import { PurchaseIntakeForm } from '@/components/elibrary/PurchaseIntakeForm';
import { acquisitionsService } from '@/src/features/library/services/acquisitions.service';
import { canViewCostData } from '@/src/features/library/hooks/useLibrarianPermissions';
import { useAuthStore } from '@/src/store/authStore';
import type { PurchaseIntake } from '@/src/features/library/types/acquisitions.types';

/** #930: New purchase intake form */
export default function NewAcquisitionPage() {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (data: PurchaseIntake) => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await acquisitionsService.createIntake(data);
      setSuccessMessage('Purchase intake saved. Proceed to accession.');
      setTimeout(() => {
        router.push(`/library/acquisitions/${result.id}/accession`);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save intake');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LibraryAdminLayout requiredPermission="acquisitions" activeHref="/library/acquisitions">
      <div className="space-y-6">
        <div>
          <Link href="/library/acquisitions" className="text-sm text-indigo-600 hover:underline">
            ← Acquisitions
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">New purchase intake</h1>
        </div>
        <PurchaseIntakeForm
          canViewCost={canViewCostData(role)}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          error={error}
          successMessage={successMessage}
        />
      </div>
    </LibraryAdminLayout>
  );
}
