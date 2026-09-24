import { apiClient } from '@/src/lib/api-client';

export type SupportingDocumentKind =
  | 'transcript'
  | 'incomeEvidence'
  | 'portfolio'
  | 'recommendation';

export type DocumentScanStatus = 'pending' | 'clean' | 'rejected' | 'failed';
export type DocumentUploadStatus = 'queued' | 'uploading' | 'scanning' | 'available' | 'rejected' | 'error';

export type SupportingDocument = {
  id: string;
  applicationId: string;
  kind: SupportingDocumentKind;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  status: DocumentUploadStatus;
  scanStatus: DocumentScanStatus;
  uploadedAt: string;
  accessLogged: boolean;
};

export type UploadValidationResult = {
  valid: boolean;
  error?: string;
};

type UploadSession = {
  uploadId: string;
  uploadUrl: string;
  expiresAt: string;
  storageKey: string;
  encryption: 'server-side-managed';
  scanStatus: 'pending';
};

export const DOCUMENT_LIMITS: Record<SupportingDocumentKind, { maxBytes: number; acceptedTypes: string[] }> = {
  transcript: {
    maxBytes: 10 * 1024 * 1024,
    acceptedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  },
  incomeEvidence: {
    maxBytes: 10 * 1024 * 1024,
    acceptedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  },
  portfolio: {
    maxBytes: 25 * 1024 * 1024,
    acceptedTypes: ['application/pdf', 'image/jpeg', 'image/png', 'application/zip'],
  },
  recommendation: {
    maxBytes: 10 * 1024 * 1024,
    acceptedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  },
};

export function validateSupportingDocument(
  kind: SupportingDocumentKind,
  file: Pick<File, 'name' | 'size' | 'type'>
): UploadValidationResult {
  const limits = DOCUMENT_LIMITS[kind];
  if (!limits.acceptedTypes.includes(file.type)) {
    return { valid: false, error: 'This file type is not supported for the selected document category.' };
  }
  if (file.size === 0) {
    return { valid: false, error: 'The selected file is empty.' };
  }
  if (file.size > limits.maxBytes) {
    return { valid: false, error: `This file exceeds the ${limits.maxBytes / (1024 * 1024)} MB limit.` };
  }
  if (!file.name.trim()) {
    return { valid: false, error: 'The selected file needs a name.' };
  }
  return { valid: true };
}

async function uploadToPrivateSession(session: UploadSession, file: File): Promise<void> {
  const response = await fetch(session.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
      'x-upload-id': session.uploadId,
    },
    body: file,
  });
  if (!response.ok) {
    throw new Error('The private upload could not be completed.');
  }
}

export const supportingDocumentService = {
  list: (applicationId: string): Promise<SupportingDocument[]> =>
    apiClient.get<SupportingDocument[]>(`/scholarships/applications/${applicationId}/documents`),

  createUploadSession: (
    applicationId: string,
    kind: SupportingDocumentKind,
    file: Pick<File, 'name' | 'size' | 'type'>
  ): Promise<UploadSession> =>
    apiClient.post<UploadSession>(`/scholarships/applications/${applicationId}/documents/upload-session`, {
      kind,
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      storage: 'private-encrypted',
      accessLog: true,
    }),

  upload: async (
    applicationId: string,
    kind: SupportingDocumentKind,
    file: File
  ): Promise<SupportingDocument> => {
    const validation = validateSupportingDocument(kind, file);
    if (!validation.valid) throw new Error(validation.error);

    const session = await supportingDocumentService.createUploadSession(applicationId, kind, file);
    if (session.encryption !== 'server-side-managed' || !session.storageKey || session.uploadUrl.length === 0) {
      throw new Error('The storage service did not return a secure private upload session.');
    }
    if (!Number.isFinite(Date.parse(session.expiresAt)) || Date.parse(session.expiresAt) <= Date.now()) {
      throw new Error('The private upload session has expired. Please try again.');
    }

    await uploadToPrivateSession(session, file);
    return apiClient.post<SupportingDocument>(
      `/scholarships/applications/${applicationId}/documents/${session.uploadId}/complete`,
      { storageKey: session.storageKey }
    );
  },
};
