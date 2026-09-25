import { apiClient } from '@/src/lib/api-client';

export type InfoRequestField = {
  fieldKey: string;
  label: string;
  required: boolean;
};

export type InfoRequest = {
  id: string;
  applicationId: string;
  reviewerId: string;
  fields: InfoRequestField[];
  message: string;
  /** ISO-8601. Server enforces this; overdue requests transition to 'overdue' automatically. */
  deadline: string;
  createdAt: string;
  status: 'open' | 'responded' | 'overdue' | 'closed';
};

export type InfoResponse = {
  id: string;
  requestId: string;
  applicationId: string;
  respondedBy: string;
  /** Incremented on each update before the deadline. */
  version: number;
  answers: Record<string, string>;
  submittedAt: string;
};

export type CreateInfoRequestPayload = {
  fields: InfoRequestField[];
  message: string;
  /** ISO-8601 datetime string in the future. */
  deadline: string;
};

export type CreateInfoResponsePayload = {
  answers: Record<string, string>;
};

export type InfoRequestValidationError = { field: string; message: string };

export function validateInfoRequest(payload: CreateInfoRequestPayload): InfoRequestValidationError[] {
  const errors: InfoRequestValidationError[] = [];
  if (payload.fields.length === 0) {
    errors.push({ field: 'fields', message: 'At least one field must be specified.' });
  }
  if (!payload.message.trim()) {
    errors.push({ field: 'message', message: 'A message to the applicant is required.' });
  }
  const deadlineDate = new Date(payload.deadline);
  if (isNaN(deadlineDate.getTime())) {
    errors.push({ field: 'deadline', message: 'A valid deadline date is required.' });
  } else if (deadlineDate <= new Date()) {
    errors.push({ field: 'deadline', message: 'The deadline must be in the future.' });
  }
  return errors;
}

export function validateInfoResponse(
  payload: CreateInfoResponsePayload,
  request: InfoRequest
): InfoRequestValidationError[] {
  const errors: InfoRequestValidationError[] = [];
  if (request.status !== 'open') {
    errors.push({ field: 'status', message: 'This request is no longer open for responses.' });
    return errors;
  }
  for (const field of request.fields) {
    if (field.required && !payload.answers[field.fieldKey]?.trim()) {
      errors.push({ field: field.fieldKey, message: `"${field.label}" is required.` });
    }
  }
  return errors;
}

export function isRequestOverdue(request: InfoRequest): boolean {
  return new Date(request.deadline) < new Date();
}

export const infoRequestService = {
  list: (applicationId: string): Promise<InfoRequest[]> =>
    apiClient.get<InfoRequest[]>(
      `/scholarships/applications/${encodeURIComponent(applicationId)}/info-requests`
    ),

  create: (applicationId: string, payload: CreateInfoRequestPayload): Promise<InfoRequest> =>
    apiClient.post<InfoRequest>(
      `/scholarships/applications/${encodeURIComponent(applicationId)}/info-requests`,
      payload
    ),

  getResponse: (requestId: string): Promise<InfoResponse | null> =>
    apiClient.get<InfoResponse | null>(
      `/scholarships/info-requests/${encodeURIComponent(requestId)}/response`
    ),

  respond: (requestId: string, payload: CreateInfoResponsePayload): Promise<InfoResponse> =>
    apiClient.post<InfoResponse>(
      `/scholarships/info-requests/${encodeURIComponent(requestId)}/response`,
      payload
    ),
};
