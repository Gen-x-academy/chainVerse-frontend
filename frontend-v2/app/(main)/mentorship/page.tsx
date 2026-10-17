'use client';

import Link from 'next/link';
import { useAuthStore } from '@/src/store/authStore';
import { toIdentityRole } from '@/src/features/mentorship/identity/access';
import {
  MENTORSHIP_GLOSSARY,
  MENTORSHIP_VOCABULARY_VERSION,
  MentorshipPageShell,
  accessibleMentorshipAreas,
  canAccessMentorshipArea,
} from '@/src/features/mentorship';

const NAV_ITEMS = [
  { href: '/mentorship', label: 'Overview' },
  { href: '/mentorship/roles', label: 'Roles & permissions' },
  { href: '/mentorship/config', label: 'Capabilities' },
];

const AREA_LABELS: Record<string, string> = {
  'mentor-profile': 'Mentor professional profiles',
  'learning-profile': 'Mentee learning profiles',
  taxonomy: 'Expertise taxonomy',
  verification: 'Identity verification',
  roles: 'Role & permission matrix',
  config: 'Capability configuration',
  lifecycle: 'Engagement lifecycle',
  contracts: 'Versioned contracts',
  seed: 'Seed data console',
  availability: 'Mentor availability',
  credentials: 'Credential verification',
  trust: 'Trust indicators',
  programs: 'Organization programs',
};

export default function MentorshipHubPage() {
  const user = useAuthStore((state) => state.user);
  // The auth store carries the legacy `admin | instructor | student` roles;
  // map them onto the mentorship vocabulary before the access check.
  // map them onto the mentorship vocabulary before the checks.
  const role = toIdentityRole(user?.role);
  const allowed = canAccessMentorshipArea(role, 'hub');
  const areas = accessibleMentorshipAreas(role);

  return (
    <MentorshipPageShell
      allowed={allowed}
      title="Mentorship"
      description={`1-on-1 mentorship, backed by the v${MENTORSHIP_VOCABULARY_VERSION} shared vocabulary and a least-privilege role matrix.`}
      activeHref="/mentorship"
      navItems={NAV_ITEMS}
    >
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Your sections</h2>
        {areas.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600" role="status">
            No mentorship sections are available for your role.
          </p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {areas.map((area) => (
              <li key={area} className="rounded-xl border border-slate-200 p-4">
                <Link
                  href={`/mentorship/${area}`}
                  className="font-semibold text-indigo-700 hover:underline"
                >
                  {AREA_LABELS[area] ?? area}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Canonical vocabulary</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {MENTORSHIP_GLOSSARY.map((term) => (
            <div key={term.aggregate} className="rounded-xl border border-slate-200 p-4">
              <dt className="font-semibold text-slate-800">
                {term.term} <span className="text-xs font-normal text-slate-500">({term.idPrefix})</span>
              </dt>
              <dd className="mt-1 text-sm text-slate-600">{term.definition}</dd>
            </div>
          ))}
        </dl>
      </section>
    </MentorshipPageShell>
  );
}
