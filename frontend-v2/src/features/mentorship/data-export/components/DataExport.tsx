'use client';

import { useState } from 'react';
import type { MentorshipExportRequest } from '../types';
import { mentorshipExportService } from '../service';

type Props = {
  userId: string;
};

export function DataExport({ userId }: Props) {
  const [request, setRequest] = useState<MentorshipExportRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const req = await mentorshipExportService.request(userId);
      setRequest(req);
      setStatus('Export requested');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to request export');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {status && <div role="status">{status}</div>}
      {error && <div role="alert">{error}</div>}
      <button onClick={() => void submit()} disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded">
        {loading ? 'Requesting...' : 'Request Data Export'}
      </button>
      {request && (
        <div>
          <p>Status: {request.status}</p>
          {request.downloadUrl && <p>Download: {request.downloadUrl}</p>}
        </div>
      )}
    </div>
  );
}
