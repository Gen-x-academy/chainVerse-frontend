'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const SCHOLARSHIP_SECTIONS = [
  { href: '/scholarships', label: 'Eligibility & applications', description: 'Rule builder, consent, and supporting documents.' },
  { href: '/scholarships/staging', label: 'Staging & testnet seed', description: 'Deterministic synthetic runs with rollback manifests.' },
  { href: '/scholarships/release', label: 'Launch readiness & rollback', description: 'Go-live checklist, sign-off, and rollback planning.' },
  { href: '/scholarships/compatibility', label: 'Compatibility gate', description: 'Contract, schema, and ABI change review.' },
] as const;

export function ScholarshipsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Scholarship operator sections" className="mb-8">
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SCHOLARSHIP_SECTIONS.map((section) => {
          const isActive = pathname === section.href;
          return (
            <li key={section.href}>
              <Link
                href={section.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex h-full flex-col gap-1 rounded-2xl border p-4 text-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                  isActive
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/50'
                }`}
              >
                <span className="font-semibold">{section.label}</span>
                <span className={isActive ? 'text-indigo-700/80' : 'text-slate-500'}>{section.description}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default ScholarshipsNav;