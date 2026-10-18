import { apiClient } from '@/src/lib/api-client';
import { buildMentorshipEvent, trackMentorshipEvent } from '../analytics';
import type {
  AgreementExportBundle,
  AgreementExportFormat,
  AgreementExportJob,
} from './agreement-export';

const BASE = '/mentorship/agreements';

export interface RequestAgreementExportApiInput {
  format?: AgreementExportFormat;
  idempotencyKey?: string;
  reason?: string;
}

export const agreementExportService = {
  request: (
    agreementId: string,
    input: RequestAgreementExportApiInput = {},
  ): Promise<AgreementExportJob> =>
    apiClient.post<AgreementExportJob>(
      `${BASE}/${encodeURIComponent(agreementId)}/exports`,
      input,
    ),

  get: (jobId: string): Promise<AgreementExportJob> =>
    apiClient.get<AgreementExportJob>(`${BASE}/exports/${encodeURIComponent(jobId)}`),

  download: (token: string): Promise<AgreementExportBundle> =>
    apiClient.get<AgreementExportBundle>(
      `/mentorship/agreement-exports/${encodeURIComponent(token)}`,
    ),
};

export function trackAgreementExportRequested(
  job: AgreementExportJob,
  actorKey: string,
  occurredAt: Date = new Date(),
): void {
  trackMentorshipEvent(
    buildMentorshipEvent('agreement_export', job.agreementId, actorKey, occurredAt),
  );
}
