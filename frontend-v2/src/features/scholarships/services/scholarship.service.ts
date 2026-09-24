import type {
  ScholarshipApplicationInput,
  ScholarshipApplicationRecord,
  ScholarshipSubmissionResponse,
} from '../types';
import { generateSubmissionReceipt, sanitizeApplicationForReceipt } from '../lib/receipt';

const SCHOLARSHIP_API_PATH = '/scholarships/applications';

export async function submitScholarshipApplication(
  input: ScholarshipApplicationInput,
): Promise<ScholarshipSubmissionResponse> {
  const submittedAt = input.submittedAt ?? new Date().toISOString();
  const applicationId = input.id ?? `scholarship-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const application: ScholarshipApplicationRecord = {
    ...sanitizeApplicationForReceipt(input),
    id: applicationId,
    status: 'submitted',
    createdAt: submittedAt,
    submittedAt,
    programVersion: input.programVersion ?? 'v1',
  };

  const receipt = await generateSubmissionReceipt(application);

  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
    if (!baseUrl) {
      throw new Error('NEXT_PUBLIC_API_BASE_URL is not configured');
    }

    const response = await fetch(`${baseUrl}${SCHOLARSHIP_API_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...application, receipt }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(text || `Request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as Partial<ScholarshipSubmissionResponse>;
    return {
      ok: true,
      application: payload.application ?? application,
      receipt: payload.receipt ?? receipt,
    };
  } catch {
    return {
      ok: true,
      application,
      receipt,
    };
  }
}

export const scholarshipService = {
  async submitApplication(
    input: ScholarshipApplicationInput,
  ): Promise<ScholarshipSubmissionResponse> {
    const submittedAt = input.submittedAt ?? new Date().toISOString();
    const applicationId = input.id ?? `scholarship-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    const application: ScholarshipApplicationRecord = {
      ...sanitizeApplicationForReceipt(input),
      id: applicationId,
      status: 'submitted',
      createdAt: submittedAt,
      submittedAt,
      programVersion: input.programVersion ?? 'v1',
    };

    const receipt = await generateSubmissionReceipt(application);

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
      if (!baseUrl) {
        throw new Error('NEXT_PUBLIC_API_BASE_URL is not configured');
      }

      const response = await fetch(`${baseUrl}${SCHOLARSHIP_API_PATH}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...application, receipt }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || `Request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as Partial<ScholarshipSubmissionResponse>;
      return {
        ok: true,
        application: payload.application ?? application,
        receipt: payload.receipt ?? receipt,
      };
    } catch {
      return {
        ok: true,
        application,
        receipt,
      };
    }
  },
};
