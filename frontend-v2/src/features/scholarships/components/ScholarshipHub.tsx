'use client';

import React from 'react';
import Link from 'next/link';
import { FileText, ClipboardCheck, Award, Settings, GraduationCap } from 'lucide-react';
import { useAuthStore } from '@/src/store/authStore';
import {
  accessibleScholarshipAreas,
  type ScholarshipArea,
} from '../utils/scholarshipRoles';

const AREA_CARDS: Record<
  ScholarshipArea,
  { href: string; label: string; description: string; icon: React.ElementType }
> = {
  hub: { href: '/scholarships', label: 'Overview', description: 'Program summaries', icon: GraduationCap },
  apply: {
    href: '/scholarships/apply',
    label: 'Apply',
    description: 'Open rounds and submit an application',
    icon: FileText,
  },
  applications: {
    href: '/scholarships/applications',
    label: 'Applications',
    description: 'Review queue and status updates',
    icon: ClipboardCheck,
  },
  awards: {
    href: '/scholarships/awards',
    label: 'Awards & Disbursements',
    description: 'Awards and disbursement overview',
    icon: Award,
  },
  manage: {
    href: '/scholarships/manage',
    label: 'Manage',
    description: 'Configure programs and rounds',
    icon: Settings,
  },
};

export function ScholarshipHub() {
  const user = useAuthStore((state) => state.user);
  const areas = accessibleScholarshipAreas(user?.role).filter((area) => area !== 'hub');

  if (areas.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center" role="status">
        <GraduationCap className="mx-auto mb-3 h-10 w-10 text-gray-300" aria-hidden="true" />
        <p className="font-medium text-gray-900">Scholarships are not available for your account yet</p>
        <p className="mt-2 text-sm text-gray-500">
          Please contact the administrator if you believe this is an error.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {areas.map((area) => {
        const card = AREA_CARDS[area];
        const Icon = card.icon;
        return (
          <Link
            key={area}
            href={card.href}
            className="group rounded-lg border border-gray-200 bg-white p-6 transition hover:shadow-md"
          >
            <Icon className="mb-3 h-8 w-8 text-indigo-600" aria-hidden="true" />
            <h2 className="font-semibold text-gray-900 transition group-hover:text-indigo-600">
              {card.label}
            </h2>
            <p className="mt-1 text-sm text-gray-500">{card.description}</p>
          </Link>
        );
      })}
    </div>
  );
}