'use client';

import { useAuthStore } from '@/src/store/authStore';
import { ScholarshipPageShell } from '@/src/features/scholarships/components/ScholarshipPageShell';
import { ScholarshipFundingRounds } from '@/src/features/scholarships/funding';
import { canOperateFunding } from '@/src/features/scholarships/funding';

const NAV_ITEMS = [
  { href: '/scholarships', label: 'Overview' },
  { href: '/scholarships/treasury', label: 'Treasury' },
  { href: '/scholarships/funding', label: 'Funding' },
  { href: '/scholarships/fees', label: 'Fees' },
  { href: '/scholarships/refunds', label: 'Refunds' },
];

export default function ScholarshipFundingPage() {
  const user = useAuthStore((state) => state.user);
  const allowed = canOperateFunding(user?.role);

  return (
    <ScholarshipPageShell
      allowed={allowed}
      title="Sponsor deposits and funding rounds"
      description="Record sponsor deposits bound to an asset and a verified source account, track round progress against target, and authorize allocation changes."
      activeHref="/scholarships/funding"
      navItems={NAV_ITEMS}
    >
      <ScholarshipFundingRounds role={user?.role} sponsorId={user?.id} />
    </ScholarshipPageShell>
  );
}
