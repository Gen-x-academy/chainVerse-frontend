import { EligibilityRuleBuilder } from '../components/EligibilityRuleBuilder';
import { ApplicantConsent } from '../components/ApplicantConsent';
import { SupportingDocuments } from '../components/SupportingDocuments';
import { ReviewerPoolManager } from '../components/ReviewerPoolManager';
import { AssignmentManager } from '../components/AssignmentManager';
import { ConflictDetector } from '../components/ConflictDetector';
import { BlindReviewPanel } from '../components/BlindReviewPanel';

export function ScholarshipsPage() {
  return (
    <>
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
