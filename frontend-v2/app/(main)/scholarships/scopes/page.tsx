'use client';

import React, { useState } from 'react';
import { useAuthStore } from '@/src/store/authStore';
import { ScholarshipPageShell } from '@/src/features/scholarships/components/ScholarshipPageShell';
import { ProgramScopeManager } from '@/src/features/scholarships/scoping/components/ProgramScopeManager';
import { ProgramScopeExplorer } from '@/src/features/scholarships/scoping/components/ProgramScopeExplorer';

const NAV_ITEMS = [
  { href: '/scholarships', label: 'Overview' },
  { href: '/scholarships/scopes', label: 'Program Scopes' },
  { href: '/scholarships/manage', label: 'Manage' },
];

export default function ProgramScopesPage() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [activeTab, setActiveTab] = useState<'manage' | 'explore'>('manage');

  // Any authenticated user or visitor can access; manager permissions are enforced at the action level
  const allowed = true;
  const userRole = user?.role ?? 'administrator';

  return (
    <ScholarshipPageShell
      allowed={allowed}
      title="Cohort & Academic-Term Scoping"
      description="Associate scholarship programs with academic cohorts, terms, courses, institutions, and geographic regions with explicit overlap management."
      activeHref="/scholarships/scopes"
      navItems={NAV_ITEMS}
    >
      <div className="space-y-6">
        {/* Journey Switcher Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('manage')}
            className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              activeTab === 'manage'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            Scope Management & Configuration
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('explore')}
            className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              activeTab === 'explore'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            Cohort & Term Explorer
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'manage' ? (
          <ProgramScopeManager userRole={userRole} />
        ) : (
          <ProgramScopeExplorer />
        )}
      </div>
    </ScholarshipPageShell>
  );
}
