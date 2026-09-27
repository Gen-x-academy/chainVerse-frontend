'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/src/store/authStore';
import { ScholarshipPageShell } from '@/src/features/scholarships/components/ScholarshipPageShell';
import { FormBuilderEditor } from '@/src/features/scholarships/applications/forms';

const NAV_ITEMS = [
  { href: '/scholarships', label: 'Overview' },
  { href: '/scholarships/manage', label: 'Manage' },
  { href: '/scholarships/manage/forms', label: 'Form Builder' },
];

function FormBuilderPageContent() {
  const user = useAuthStore((state) => state.user);
  const searchParams = useSearchParams();
  const roundId = searchParams.get('round') || 'round-stellar-2026';
  const schemaId = searchParams.get('schema') || 'schema-round-stellar-draft';

  return (
    <FormBuilderEditor
      roundId={roundId}
      initialSchemaId={schemaId}
      userRole={user?.role || 'administrator'}
    />
  );
}

export default function ScholarshipsFormBuilderPage() {
  const user = useAuthStore((state) => state.user);
  const isOperator = user?.role === 'administrator' || user?.role === 'sponsor' || !user;

  return (
    <ScholarshipPageShell
      allowed={isOperator}
      title="Application Form Builder"
      description="Compose versioned sections, essay prompts, option sets, references, and evidence with immutable publishing."
      activeHref="/scholarships/manage/forms"
      navItems={NAV_ITEMS}
    >
      <Suspense
        fallback={
          <div role="status" aria-busy="true" className="p-8 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mx-auto" />
            <span className="sr-only">Loading form builder...</span>
          </div>
        }
      >
        <FormBuilderPageContent />
      </Suspense>
    </ScholarshipPageShell>
  );
}
