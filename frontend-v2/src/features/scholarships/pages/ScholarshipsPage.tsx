'use client';

import { ScholarshipApplicationForm } from '../components/ScholarshipApplicationForm';
import { ScholarshipReceipt } from '../components/ScholarshipReceipt';
import { useScholarshipStore } from '../store/scholarshipStore';

export function ScholarshipsPage() {
  const { application, receipt, status, error } = useScholarshipStore();

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-700">Scholarships</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">Support the next generation</h1>
          <p className="mt-3 text-base text-slate-600">
            Apply for the scholarship, bursary, or sponsorship program that best matches your goals.
          </p>
        </header>

        {status === 'loading' && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700" role="status" aria-live="polite">
            Submitting your application and generating a tamper-evident receipt...
          </div>
        )}

        {status === 'error' && !receipt && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
            {error ?? 'Unable to process the application.'}
          </div>
        )}

        {!receipt ? <ScholarshipApplicationForm /> : <ScholarshipReceipt receipt={receipt} application={application} />}
      </div>
    </main>
  );
}
import { EligibilityRuleBuilder } from '../components/EligibilityRuleBuilder';
import { ApplicantConsent } from '../components/ApplicantConsent';
import { SupportingDocuments } from '../components/SupportingDocuments';
import { ReviewerPoolManager } from '../components/ReviewerPoolManager';
import { AssignmentManager } from '../components/AssignmentManager';
import { ConflictDetector } from '../components/ConflictDetector';
import { BlindReviewPanel } from '../components/BlindReviewPanel';
import { ScholarshipsNav } from '../components/ScholarshipsNav';

export function ScholarshipsPage() {
  return (
    <>
      <ScholarshipsNav />
      <EligibilityRuleBuilder />
      <ApplicantConsent />
      <SupportingDocuments />
      <ReviewerPoolManager />
      <AssignmentManager />
      <ConflictDetector />
      <BlindReviewPanel />
    </>
  );
}

export default ScholarshipsPage;
