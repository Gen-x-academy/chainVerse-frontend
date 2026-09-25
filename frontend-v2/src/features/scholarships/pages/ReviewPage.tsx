import { ScoringRubricBuilder } from '../components/ScoringRubricBuilder';
import { ReviewDraftPanel } from '../components/ReviewDraftPanel';
import { ReviewSubmissionPanel } from '../components/ReviewSubmissionPanel';
import { InfoRequestPanel } from '../components/InfoRequestPanel';
import { ScholarshipsNav } from '../components/ScholarshipsNav';

const DEMO_ROUND_ID = 'round-demo';

const demoRubric = {
  id: 'rubric-demo',
  name: 'Standard Merit Rubric',
  description: 'Used for all open scholarship rounds.',
  version: 1,
  status: 'published' as const,
  criteria: [
    {
      id: 'c-academic',
      name: 'Academic merit',
      description: 'Quality and consistency of academic record.',
      weightPercent: 50,
      scale: [
        { value: 0, label: 'Insufficient', description: 'Does not meet bar.' },
        { value: 1, label: 'Developing', description: 'Partially meets bar.' },
        { value: 2, label: 'Proficient', description: 'Meets bar.' },
        { value: 3, label: 'Excellent', description: 'Exceeds bar.' },
      ],
      guidanceNotes: 'Consider GPA trend, course difficulty, and institutional context.',
      requiresComment: false,
      disqualifyingThreshold: 1,
    },
    {
      id: 'c-impact',
      name: 'Community impact',
      description: 'Evidence of meaningful contribution to the applicant\'s community.',
      weightPercent: 50,
      scale: [
        { value: 0, label: 'None', description: 'No evidence.' },
        { value: 1, label: 'Some', description: 'Limited evidence.' },
        { value: 2, label: 'Moderate', description: 'Clear evidence.' },
        { value: 3, label: 'Significant', description: 'Strong documented impact.' },
      ],
      guidanceNotes: 'Look for specificity and sustainability, not just activity count.',
      requiresComment: true,
    },
  ],
  createdAt: '2024-01-01T00:00:00Z',
  publishedAt: '2024-01-02T00:00:00Z',
};

export function ReviewPage() {
  return (
    <>
      <ScholarshipsNav />
      <ScoringRubricBuilder roundId={DEMO_ROUND_ID} existingRubric={demoRubric} />
      <ReviewDraftPanel
        applicationId="app-demo"
        reviewerId="reviewer-demo"
        rubric={demoRubric}
      />
      <ReviewSubmissionPanel
        applicationId="app-demo"
        reviewerId="reviewer-demo"
        rubric={demoRubric}
      />
      <InfoRequestPanel
        applicationId="app-demo"
        reviewerId="reviewer-demo"
      />
    </>
  );
}

export default ReviewPage;
