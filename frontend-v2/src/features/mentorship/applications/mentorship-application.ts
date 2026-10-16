/** MENTOR-030: create mentorship applications (draft -> submitted) with duplicate-safe submission. */
export type ApplicationStatus = 'draft' | 'submitted' | 'withdrawn';

export interface MentorshipApplication {
  id: string;
  programId: string;
  applicantId: string;
  formVersion: number;
  answers: Record<string, string | number | boolean | string[]>;
  status: ApplicationStatus;
  createdAt: string;
  submittedAt?: string;
  /** Client-generated key so a retried submit cannot create a second application. */
  submissionKey?: string;
}

export function createDraft(programId: string, applicantId: string, formVersion: number, now: Date = new Date()): MentorshipApplication {
  return {
    id: `${programId}:${applicantId}`,
    programId,
    applicantId,
    formVersion,
    answers: {},
    status: 'draft',
    createdAt: now.toISOString(),
  };
}

export function setAnswer(app: MentorshipApplication, questionId: string, value: MentorshipApplication['answers'][string]): MentorshipApplication {
  if (app.status !== 'draft') throw new Error('Only draft applications can be edited');
  return { ...app, answers: { ...app.answers, [questionId]: value } };
}

/** Submit once; repeating the same key returns the already-submitted application. */
export function submitApplication(
  app: MentorshipApplication,
  requiredQuestionIds: string[],
  submissionKey: string,
  now: Date = new Date(),
): MentorshipApplication {
  if (app.status === 'submitted' && app.submissionKey === submissionKey) return app;
  if (app.status !== 'draft') throw new Error('This application can no longer be submitted');
  const missing = requiredQuestionIds.filter((id) => {
    const v = app.answers[id];
    return v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
  });
  if (missing.length) throw new Error(`Answer required questions: ${missing.join(', ')}`);
  return { ...app, status: 'submitted', submittedAt: now.toISOString(), submissionKey };
}

export const canEdit = (app: MentorshipApplication): boolean => app.status === 'draft';
