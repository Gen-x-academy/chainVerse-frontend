import { describe, expect, it, vi } from 'vitest';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

import { apiClient } from '@/src/lib/api-client';
import { libraryService } from '../library.service';

describe('libraryService donation intake endpoints', () => {
  it('searches the typed catalog-match endpoint with encoded criteria', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce([]);

    await libraryService.searchCatalogMatches({ isbn: '978 1', title: 'A & B', author: 'Ada' });

    expect(apiClient.get).toHaveBeenCalledWith('/library/donations/catalog-matches?isbn=978+1&title=A+%26+B&author=Ada');
  });

  it('submits location and rejection fields unchanged for server-side validation', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ id: 'donation-42' });
    const payload = {
      donor: { name: 'Jane', email: 'jane@example.com' },
      preferences: { anonymous: false, acknowledgmentLetter: true, taxReceipt: false, returnIfRejected: true },
      title: 'A book', author: 'An author', condition: 'good' as const,
      location: { branchId: 'branch-1', shelfId: 'shelf-2' },
      status: 'rejected' as const, rejectionReason: 'Duplicate copy',
    };

    await libraryService.submitDonationIntake(payload);

    expect(apiClient.post).toHaveBeenCalledWith('/library/donations/intake', payload);
  });
});
