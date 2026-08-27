import { apiClient } from '@/src/lib/api-client';
import type {
  AccessionCopy,
  AccessionRecord,
  AcquisitionQueueItem,
  PurchaseIntake,
} from '../types/acquisitions.types';

export class AcquisitionsError extends Error {
  constructor(
    message: string,
    public readonly code: 'forbidden' | 'validation' | 'not-found' | 'unknown',
  ) {
    super(message);
    this.name = 'AcquisitionsError';
  }
}

function mapError(err: unknown): AcquisitionsError {
  const message = err instanceof Error ? err.message : 'Unknown error';
  if (message.includes('403') || message.toLowerCase().includes('forbidden')) {
    return new AcquisitionsError('You do not have permission for acquisitions.', 'forbidden');
  }
  if (message.includes('404')) {
    return new AcquisitionsError('Record not found.', 'not-found');
  }
  if (message.includes('400')) {
    return new AcquisitionsError('Validation failed.', 'validation');
  }
  return new AcquisitionsError(message, 'unknown');
}

/** #930: Purchase intake and accession workflows */
export const acquisitionsService = {
  async listQueue(): Promise<AcquisitionQueueItem[]> {
    try {
      return await apiClient.get<AcquisitionQueueItem[]>('/library/acquisitions');
    } catch (err) {
      throw mapError(err);
    }
  },

  async getIntake(id: string): Promise<PurchaseIntake & { id: string }> {
    try {
      return await apiClient.get<PurchaseIntake & { id: string }>(`/library/acquisitions/${id}`);
    } catch (err) {
      throw mapError(err);
    }
  },

  async createIntake(data: PurchaseIntake): Promise<{ id: string; bookRecordId?: string }> {
    try {
      return await apiClient.post<{ id: string; bookRecordId?: string }>('/library/acquisitions', data);
    } catch (err) {
      throw mapError(err);
    }
  },

  async getAccession(intakeId: string): Promise<AccessionRecord | null> {
    try {
      return await apiClient.get<AccessionRecord>(`/library/acquisitions/${intakeId}/accession`);
    } catch (err) {
      if (err instanceof Error && err.message.includes('404')) return null;
      throw mapError(err);
    }
  },

  async submitAccession(
    intakeId: string,
    copies: AccessionCopy[],
  ): Promise<AccessionRecord> {
    try {
      return await apiClient.post<AccessionRecord>(
        `/library/acquisitions/${intakeId}/accession`,
        { copies },
      );
    } catch (err) {
      throw mapError(err);
    }
  },
};
