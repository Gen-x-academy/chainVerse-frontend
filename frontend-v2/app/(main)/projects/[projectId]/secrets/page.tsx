'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/src/store/authStore';
import { ProjectSecretsPanel } from '@/src/features/capstone/components/ProjectSecretsPanel';
import { CapstonePermissionDeniedState } from '@/src/features/capstone/components/CapstoneSharedStates';

export default function ProjectSecretsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId =
    typeof params?.projectId === 'string'
      ? params.projectId
      : Array.isArray(params?.projectId)
      ? params.projectId[0]
      : '';

  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated || !user) {
    return (
      <div className="py-8">
        <CapstonePermissionDeniedState message="Please sign in to view project secrets and sensitive fields." />
      </div>
    );
  }

  const actor = {
    id: user.id ?? 'usr_participant',
    organizationId: user.organizationId ?? 'org_default',
    role: user.role ?? 'student',
    isProjectOwner: true,
  };

  return (
    <div className="space-y-6 py-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-gray-500">
        <Link href="/projects/dashboard" className="hover:text-gray-900">
          Projects
        </Link>
        <span>/</span>
        <Link href={`/projects/${projectId}/workspace`} className="hover:text-gray-900">
          {projectId}
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">Secrets & Sensitive Fields</span>
      </nav>

      <ProjectSecretsPanel
        projectId={projectId}
        organizationId={actor.organizationId}
        actor={actor}
      />
    </div>
  );
}
