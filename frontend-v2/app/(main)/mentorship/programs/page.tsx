'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/src/store/authStore';
import {
  MentorshipPageShell,
  canAccessMentorshipArea,
} from '@/src/features/mentorship';
import { toIdentityRole } from '@/src/features/mentorship/identity/access';
import {
  ProgramManagerPanel,
  useProgramStore,
} from '@/src/features/mentorship/programs';

const NAV_ITEMS = [
  { href: '/mentorship/programs', label: 'Programs' },
];

export default function MentorshipProgramsPage() {
  const user = useAuthStore((state) => state.user);
  // The auth store carries the legacy `admin | instructor | student` roles;
  // map them onto the mentorship vocabulary before the area checks.
  const role = toIdentityRole(user?.role);
  const canManage = canAccessMentorshipArea(role, 'programs') &&
    (role === 'organization-staff' || role === 'administrator');
  const canRead = canAccessMentorshipArea(role, 'programs');

  return canManage ? (
    <MentorshipPageShell
      allowed={canManage}
      title="Mentorship programs"
      description="Draft, publish, and organize programs around an audience, outcomes, capacity, duration, and delivery mode."
      activeHref="/mentorship/programs"
      navItems={NAV_ITEMS}
    >
      <ProgramManagerPanel />
    </MentorshipPageShell>
  ) : (
    <MentorshipPageShell
      allowed={canRead}
      title="Mentorship programs"
      description="Programs organize mentorship around an audience, outcomes, capacity, duration, and delivery mode."
      activeHref="/mentorship/programs"
      navItems={NAV_ITEMS}
    >
      <PublishedPrograms />
    </MentorshipPageShell>
  );
}

function PublishedPrograms() {
  const programs = useProgramStore((state) => state.programs);
  const load = useProgramStore((state) => state.load);
  const status = useProgramStore((state) => state.status);
  const error = useProgramStore((state) => state.error);

  useEffect(() => {
    if (status === 'idle') {
      void load();
    }
  }, [status, load]);

  const published = programs.filter((program) => program.status === 'published');

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <header className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Published programs</h2>
      </header>
      <div className="p-6">
        {error ? (
          <p role="alert" className="text-sm text-red-600">{error}</p>
        ) : status === 'loading' ? (
          <p className="text-sm text-gray-500">Loading programs...</p>
        ) : published.length === 0 ? (
          <p className="text-sm text-gray-500">No published programs yet.</p>
        ) : (
          <ul className="space-y-4">
            {published.map((program) => (
              <li key={program.internalId} className="rounded-lg border border-gray-200 p-4">
                <p className="font-medium text-gray-900">{program.name}</p>
                <p className="text-sm text-gray-500">{program.organizationId}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
