import { EligibilityRuleBuilder } from '../components/EligibilityRuleBuilder';
import { ApplicantConsent } from '../components/ApplicantConsent';
import { SupportingDocuments } from '../components/SupportingDocuments';
import { ScholarshipsNav } from '../components/ScholarshipsNav';

export function ScholarshipsPage() {
  return (
    <>
      <ScholarshipsNav />
      <EligibilityRuleBuilder />
      <ApplicantConsent />
      <SupportingDocuments />
    </>
  );
}

export default ScholarshipsPage;
