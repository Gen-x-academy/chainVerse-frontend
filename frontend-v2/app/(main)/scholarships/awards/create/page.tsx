'use client';

import { useAuthStore } from '@/src/store/authStore';
import {
  AwardRecordForm,
  canAccessScholarshipArea,
  ScholarshipPageShell,
} from '@/src/features/scholarships';

const NAV_ITEMS = [
  { href: '/scholarships', label: 'Overview' },
  { href: '/scholarships/awards', label: 'Awards' },
  { href: '/scholarships/awards/create', label: 'Create Award' },
  { href: '/scholarships/awards/accept', label: 'Accept Award' },
  { href: '/scholarships/awards/cancel', label: 'Cancellations' },
  { href: '/scholarships/awards/schedule', label: 'Disbursement Schedules' },
];

export default function CreateAwardPage() {
  const user = useAuthStore((state) => state.user);
  const allowed = canAccessScholarshipArea(user?.role, 'awards');

  return (
    <ScholarshipPageShell
      allowed={allowed}
      title="Create Award Record"
      description="Create a new scholarship award with amount, currency, terms, and an acceptance deadline."
      activeHref="/scholarships/awards/create"
      navItems={NAV_ITEMS}
    >
      <AwardRecordForm />
    </ScholarshipPageShell>
  );
}
