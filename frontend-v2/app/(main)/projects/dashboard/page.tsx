'use client';

import React from 'react';
import { useAuthStore } from '@/src/store/authStore';
import { ParticipantDashboardView } from '@/src/features/capstone/components/ParticipantDashboardView';
import { CapstonePermissionDeniedState } from '@/src/features/capstone/components/CapstoneSharedStates';
import type { ParticipantDashboardState } from '@/src/features/capstone/participant-dashboard';

export default function ParticipantProjectsDashboardPage() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated || !user) {
    return (
      <div className="py-8">
        <CapstonePermissionDeniedState message="Please sign in to access your participant project dashboard." />
      </div>
    );
  }

  const participantId = user.id ?? 'usr_participant';
  const organizationId = user.organizationId ?? 'org_default';
  const role = user.role ?? 'student';
  const now = new Date().toISOString();

  const initialDashboard: ParticipantDashboardState = {
    participantId,
    organizationId,
    role,
    sections: {
      deadlines: {
        status: 'ready',
        items: [
          {
            id: 'dl_capstone_1',
            projectId: 'prj_capstone_alpha',
            projectTitle: 'Decentralized Research Ledger',
            title: 'Milestone 2: Architecture Specification',
            dueAt: new Date(Date.now() + 86400000 * 3).toISOString(),
            isOverdue: false,
            priority: 'high',
            kind: 'milestone',
          },
          {
            id: 'dl_capstone_2',
            projectId: 'prj_capstone_alpha',
            projectTitle: 'Decentralized Research Ledger',
            title: 'Ethics Screening Protocol Approval',
            dueAt: new Date(Date.now() - 86400000 * 1).toISOString(),
            isOverdue: true,
            priority: 'critical',
            kind: 'ethics',
          },
        ],
      },
      invitations: {
        status: 'ready',
        items: [
          {
            id: 'inv_capstone_1',
            projectId: 'prj_capstone_beta',
            projectTitle: 'Zero-Knowledge Privacy Layer',
            inviterName: 'Dr. Jane Vance',
            roleOffered: 'Core Researcher',
            sentAt: now,
            expiresAt: new Date(Date.now() + 86400000 * 7).toISOString(),
            status: 'pending',
            revision: 1,
          },
        ],
      },
      projects: {
        status: 'ready',
        items: [
          {
            id: 'prj_capstone_alpha',
            title: 'Decentralized Research Ledger',
            summary: 'Verifiable audit trails and privacy-preserving consent for academic research.',
            role: 'Lead Contributor',
            state: 'active',
            memberCount: 4,
            progressPercent: 55,
            isOwner: true,
            canManagePrivacy: true,
            canManageSecrets: true,
          },
        ],
      },
      milestones: {
        status: 'ready',
        items: [
          {
            id: 'mil_capstone_1',
            projectId: 'prj_capstone_alpha',
            projectTitle: 'Decentralized Research Ledger',
            title: 'Milestone 1: Problem Definition & Threat Model',
            dueAt: new Date(Date.now() - 86400000 * 14).toISOString(),
            status: 'accepted',
            completionPercent: 100,
          },
          {
            id: 'mil_capstone_2',
            projectId: 'prj_capstone_alpha',
            projectTitle: 'Decentralized Research Ledger',
            title: 'Milestone 2: Architecture Specification',
            dueAt: new Date(Date.now() + 86400000 * 3).toISOString(),
            status: 'in_progress',
            completionPercent: 65,
          },
        ],
      },
      reviews: {
        status: 'ready',
        items: [
          {
            id: 'rev_capstone_1',
            projectId: 'prj_capstone_alpha',
            projectTitle: 'Decentralized Research Ledger',
            itemTitle: 'Originality & Citation Verification',
            dueAt: new Date(Date.now() + 86400000 * 5).toISOString(),
            status: 'assigned',
            isAwaitingMyAction: true,
          },
        ],
      },
      funding: {
        status: 'ready',
        items: [
          {
            id: 'fnd_capstone_1',
            projectId: 'prj_capstone_alpha',
            projectTitle: 'Decentralized Research Ledger',
            awardAmount: '12500',
            currency: 'USDC',
            state: 'awarded',
            canClaimReimbursement: true,
            canApproveBudget: role === 'administrator' || role === 'finance_staff',
          },
        ],
      },
      alerts: {
        status: 'ready',
        items: [
          {
            id: 'alt_capstone_1',
            title: 'Upcoming Milestone Deadline',
            message: 'Milestone 2 deliverable is due in 3 days.',
            severity: 'info',
            createdAt: now,
          },
        ],
      },
      activity: {
        status: 'ready',
        items: [
          {
            id: 'act_capstone_1',
            projectId: 'prj_capstone_alpha',
            projectTitle: 'Decentralized Research Ledger',
            actorName: user.email ?? 'Current User',
            actionSummary: 'Updated project field-level privacy settings',
            occurredAt: now,
          },
        ],
      },
    },
  };

  return (
    <div className="py-6">
      <ParticipantDashboardView initialDashboard={initialDashboard} />
    </div>
  );
}
