import { CompatibilityGate } from '../components/CompatibilityGate';
import { ScholarshipsNav } from '../components/ScholarshipsNav';

export function CompatibilityPage() {
  return (
    <>
      <ScholarshipsNav />
      <CompatibilityGate />
    </>
  );
}

export default CompatibilityPage;