import { CommitteeWorkflowPanel } from '@/src/features/scholarships/decisions/components';
import { ScholarshipsNav } from '@/src/features/scholarships/components/ScholarshipsNav';
import type { CommitteeDecision } from '@/src/features/scholarships/decisions/types';

const DEMO_DECISION: CommitteeDecision = {
  id: 'decision-demo',
  applicationId: 'app-demo',
  aggregateVersion: 'v1-2024-01-15',
  committee: [
    { userId: 'chair-001', role: 'chair', name: 'Dr. Amara Diallo' },
    { userId: 'member-001', role: 'member', name: 'Prof. Kemi Adeyemi' },
    { userId: 'member-002', role: 'member', name: 'Dr. Lena Fischer' },
    { userId: 'observer-001', role: 'observer', name: 'Compliance Officer' },
  ],
  votes: [],
  recusals: [],
  quorumPolicy: { minVotes: 2, requireChairVote: true },
  status: 'in_progress',
  createdAt: '2024-01-15T09:00:00Z',
};

export default function DecisionsPage() {
  return (
    <>
      <ScholarshipsNav />
      <CommitteeWorkflowPanel
        decision={DEMO_DECISION}
        currentUserId="chair-001"
      />
    </>
  );
}
