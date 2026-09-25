import { AppealSubmissionForm, AppealReviewPanel } from '@/src/features/scholarships/appeals/components';
import { ScholarshipsNav } from '@/src/features/scholarships/components/ScholarshipsNav';
import type { Appeal } from '@/src/features/scholarships/appeals/types';

const DEMO_APPEAL: Appeal = {
  id: 'appeal-demo',
  applicationId: 'app-demo',
  decisionId: 'decision-demo',
  appellantId: 'student-001',
  grounds: 'calculation_error',
  statement: 'The normalized aggregate score calculation appears to contain an error in the weighting applied to the community impact criterion. The rubric specifies a 50% weight but the score sheet reflects a 30% contribution, materially altering the outcome.',
  evidence: [],
  deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  status: 'under_review',
  excludedReviewerIds: ['reviewer-001', 'reviewer-002'],
  submittedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
};

export default function AppealsPage() {
  return (
    <>
      <ScholarshipsNav />
      <AppealSubmissionForm
        applicationId="app-demo"
        decisionId="decision-demo"
        decisionType="reject"
        appellantId="student-001"
        appealDeadline={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()}
        originalReviewerIds={['reviewer-001', 'reviewer-002']}
        existingAppeals={[]}
      />
      <AppealReviewPanel
        appeal={DEMO_APPEAL}
        existingDecisions={[]}
        reviewerId="reviewer-003"
      />
    </>
  );
}
