'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/src/store/authStore';
import { ScholarshipPageShell } from '@/src/features/scholarships/components/ScholarshipPageShell';
import { ApplicationAnswerForm } from '@/src/features/scholarships/applications/validation';

const NAV_ITEMS = [
  { href: '/scholarships', label: 'Overview' },
  { href: '/scholarships/apply', label: 'Apply' },
  { href: '/scholarships/apply/questionnaire', label: 'Questionnaire & Answers' },
];

function QuestionnaireContent() {
  const user = useAuthStore((state) => state.user);
  const searchParams = useSearchParams();
  const roundId = searchParams.get('round') || 'round-stellar-2026';

  return (
    <ApplicationAnswerForm
      roundId={roundId}
      studentId={user?.id || 'student-current'}
      userRole={user?.role || 'student'}
    />
  );
}

export default function ApplicationQuestionnairePage() {
  return (
    <ScholarshipPageShell
      allowed={true}
      title="Application Questionnaire &amp; Answers"
      description="Provide validated responses to scholarship round prompts with real-time word limit enforcement."
      activeHref="/scholarships/apply/questionnaire"
      navItems={NAV_ITEMS}
    >
      <Suspense
        fallback={
          <div role="status" aria-busy="true" className="p-8 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mx-auto" />
            <span className="sr-only">Loading questionnaire...</span>
          </div>
        }
      >
        <QuestionnaireContent />
      </Suspense>
    </ScholarshipPageShell>
  );
}
