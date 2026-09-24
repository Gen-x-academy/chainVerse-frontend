import { EligibilityRuleBuilder } from '../components/EligibilityRuleBuilder';
import { ApplicantConsent } from '../components/ApplicantConsent';
import { SupportingDocuments } from '../components/SupportingDocuments';

export function ScholarshipsPage() {
  return (
    <>
      <EligibilityRuleBuilder />
      <ApplicantConsent />
      <SupportingDocuments />
    </>
  );
}

export default ScholarshipsPage;
