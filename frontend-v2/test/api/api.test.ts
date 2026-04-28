import { vi, describe, it, expect, beforeEach } from 'vitest';
import { fetchData } from '@/services/api';

global.fetch = vi.fn();

describe('API Integration Tests', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockClear();
  });

  it('should fetch data successfully', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      json: async () => ({ data: [1, 2, 3] }),
    } as Response);

    const result = await fetchData('/test');

    expect(fetch).toHaveBeenCalledWith('/test');
    expect(result).toEqual({ data: [1, 2, 3] });
  });

  it('should handle API failure', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('API error'));

    await expect(fetchData('/test')).rejects.toThrow('API error');
  });
});
