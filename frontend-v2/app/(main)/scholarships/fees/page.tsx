'use client';

import { useAuthStore } from '@/src/store/authStore';
import { ScholarshipPageShell } from '@/src/features/scholarships/components/ScholarshipPageShell';
import { ScholarshipFeeCalculator } from '@/src/features/scholarships/fees';
import { canManageFees } from '@/src/features/scholarships/fees';

const NAV_ITEMS = [
  { href: '/scholarships', label: 'Overview' },
  { href: '/scholarships/treasury', label: 'Treasury' },
  { href: '/scholarships/funding', label: 'Funding' },
  { href: '/scholarships/fees', label: 'Fees' },
  { href: '/scholarships/refunds', label: 'Refunds' },
];

export default function ScholarshipFeesPage() {
  const user = useAuthStore((state) => state.user);
  const allowed = canManageFees(user?.role);

  return (
    <ScholarshipPageShell
      allowed={allowed}
      title="Platform and network fees"
      description="Quote fees on a gross amount against a versioned schedule, verify that net plus fees always equals gross, and review fee revenue separately from disbursement."
      activeHref="/scholarships/fees"
      navItems={NAV_ITEMS}
    >
      <ScholarshipFeeCalculator role={user?.role} />
    </ScholarshipPageShell>
  );
}
