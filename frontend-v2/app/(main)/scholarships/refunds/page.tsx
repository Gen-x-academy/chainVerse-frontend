'use client';

import { useAuthStore } from '@/src/store/authStore';
import { ScholarshipPageShell } from '@/src/features/scholarships/components/ScholarshipPageShell';
import { ScholarshipRefundPanel } from '@/src/features/scholarships/refunds';
import { canOperateRefunds } from '@/src/features/scholarships/refunds';

const NAV_ITEMS = [
  { href: '/scholarships', label: 'Overview' },
  { href: '/scholarships/treasury', label: 'Treasury' },
  { href: '/scholarships/funding', label: 'Funding' },
  { href: '/scholarships/fees', label: 'Fees' },
  { href: '/scholarships/refunds', label: 'Refunds' },
];

export default function ScholarshipRefundsPage() {
  const user = useAuthStore((state) => state.user);
  const allowed = canOperateRefunds(user?.role);

  return (
    <ScholarshipPageShell
      allowed={allowed}
      title="Refunds and returned payments"
      description="Raise, authorize, and settle refunds against a solvent treasury, and keep returned payments on the ledger as reversals rather than deletions."
      activeHref="/scholarships/refunds"
      navItems={NAV_ITEMS}
    >
      <ScholarshipRefundPanel role={user?.role} actorId={user?.id} />
    </ScholarshipPageShell>
  );
}
