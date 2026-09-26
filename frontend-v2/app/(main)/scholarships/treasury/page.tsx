'use client';

import { useAuthStore } from '@/src/store/authStore';
import { ScholarshipPageShell } from '@/src/features/scholarships/components/ScholarshipPageShell';
import { ScholarshipTreasuryReconciliation } from '@/src/features/scholarships/treasury';
import { canOperateTreasury } from '@/src/features/scholarships/treasury';

const NAV_ITEMS = [
  { href: '/scholarships', label: 'Overview' },
  { href: '/scholarships/treasury', label: 'Treasury' },
  { href: '/scholarships/funding', label: 'Funding' },
  { href: '/scholarships/fees', label: 'Fees' },
  { href: '/scholarships/refunds', label: 'Refunds' },
];

export default function ScholarshipTreasuryPage() {
  const user = useAuthStore((state) => state.user);
  const allowed = canOperateTreasury(user?.role);

  return (
    <ScholarshipPageShell
      allowed={allowed}
      title="Treasury reconciliation"
      description="Reconcile treasury balances against recorded liabilities, review discrepancies, and see whether new awards are currently gated."
      activeHref="/scholarships/treasury"
      navItems={NAV_ITEMS}
    >
      <ScholarshipTreasuryReconciliation role={user?.role} programId={undefined} />
    </ScholarshipPageShell>
  );
}
