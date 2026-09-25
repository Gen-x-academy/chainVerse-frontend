import { apiClient } from '@/src/lib/api-client';
import type {
  AmendSchedulePayload,
  AssignVerifierPayload,
  CreateSchedulePayload,
  DisbursementSchedule,
  MilestoneEvidence,
  RecordDecisionPayload,
  SubmitEvidencePayload,
  SubmitEvidenceResult,
  VerifierDecision,
} from './types';

export const milestoneEvidenceService = {
  submit: (payload: SubmitEvidencePayload): Promise<SubmitEvidenceResult> =>
    apiClient.post<SubmitEvidenceResult>(
      '/scholarships/milestones/evidence',
      payload
    ),

  getByMilestone: (milestoneId: string): Promise<MilestoneEvidence[]> =>
    apiClient.get<MilestoneEvidence[]>(
      `/scholarships/milestones/${milestoneId}/evidence`
    ),

  getById: (evidenceId: string): Promise<MilestoneEvidence> =>
    apiClient.get<MilestoneEvidence>(
      `/scholarships/milestones/evidence/${evidenceId}`
    ),
};

export const milestoneVerifierService = {
  assign: (payload: AssignVerifierPayload): Promise<void> =>
    apiClient.post<void>(
      '/scholarships/milestones/evidence/assign-verifier',
      payload
    ),

  recordDecision: (payload: RecordDecisionPayload): Promise<VerifierDecision> =>
    apiClient.post<VerifierDecision>(
      '/scholarships/milestones/evidence/decision',
      payload
    ),

  getDecisions: (evidenceId: string): Promise<VerifierDecision[]> =>
    apiClient.get<VerifierDecision[]>(
      `/scholarships/milestones/evidence/${evidenceId}/decisions`
    ),
};

// Issue #1115 — Milestone-based disbursement schedules
export const disbursementScheduleService = {
  create: (payload: CreateSchedulePayload): Promise<DisbursementSchedule> =>
    apiClient.post<DisbursementSchedule>('/scholarships/awards/schedules', payload),

  getByAward: (awardId: string): Promise<DisbursementSchedule | null> =>
    apiClient.get<DisbursementSchedule | null>(
      `/scholarships/awards/${encodeURIComponent(awardId)}/schedule`
    ),

  activate: (scheduleId: string): Promise<DisbursementSchedule> =>
    apiClient.post<DisbursementSchedule>(
      `/scholarships/awards/schedules/${encodeURIComponent(scheduleId)}/activate`,
      {}
    ),

  amend: (payload: AmendSchedulePayload): Promise<DisbursementSchedule> =>
    apiClient.post<DisbursementSchedule>(
      `/scholarships/awards/schedules/${encodeURIComponent(payload.scheduleId)}/amend`,
      payload
    ),
};
