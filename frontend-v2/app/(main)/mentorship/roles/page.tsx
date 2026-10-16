'use client';

import { useAuthStore } from '@/src/store/authStore';
import {
  MentorshipPageShell,
  RolePermissionMatrix,
  canAccessMentorshipArea,
} from '@/src/features/mentorship';

const NAV_ITEMS = [
  { href: '/mentorship', label: 'Overview' },
  { href: '/mentorship/roles', label: 'Roles & permissions' },
  { href: '/mentorship/config', label: 'Capabilities' },
];

export default function MentorshipRolesPage() {
  const user = useAuthStore((state) => state.user);
  const role = user?.role;
  const allowed = canAccessMentorshipArea(role, 'roles');

  return (
    <MentorshipPageShell
      allowed={allowed}
      title="Role and permission matrix"
      description="Least-privilege actions for students, tutors, mentors, guardians, organization staff, moderators, finance staff, and administrators."
      activeHref="/mentorship/roles"
      navItems={NAV_ITEMS}
    >
      <RolePermissionMatrix canView={allowed} />
    </MentorshipPageShell>
  );
}
