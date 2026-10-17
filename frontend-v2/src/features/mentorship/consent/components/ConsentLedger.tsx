'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ConsentPurpose, ConsentRecord } from '../types';
import { mentorshipConsentService } from '../service';

type Props = {
  userId: string;
};

const PURPOSES: ConsentPurpose[] = ['matching', 'calendar', 'recording', 'analytics', 'credentials', 'research'];

export function ConsentLedger({ userId }: Props) {
  const [records, setRecords] = useState<ConsentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRecords(await mentorshipConsentService.list(userId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load consent records');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (purpose: ConsentPurpose) => {
    const rec = records.find((r) => r.purpose === purpose);
    if (!rec) return;
    try {
      if (rec.status === 'granted') {
        const updated = await mentorshipConsentService.withdraw(userId, purpose, rec.version);
        setRecords((rs) => rs.map((r) => (r.purpose === purpose ? updated : r)));
        setStatus('Consent withdrawn');
      } else {
        const updated = await mentorshipConsentService.grant(userId, purpose, rec.version, 'ui');
        setRecords((rs) => rs.map((r) => (r.purpose === purpose ? updated : r)));
        setStatus('Consent granted');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update consent');
    }
  };

  if (loading) return <div role="status">Loading consent ledger...</div>;
  if (error) return <div role="alert">{error}</div>;

  return (
    <div className="space-y-4">
      {status && <div role="status">{status}</div>}
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left">Purpose</th>
            <th className="text-left">Status</th>
            <th className="text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          {PURPOSES.map((p) => {
            const rec = records.find((r) => r.purpose === p);
            return (
              <tr key={p}>
                <td>{p}</td>
                <td>{rec?.status ?? 'unknown'}</td>
                <td>
                  <button onClick={() => void toggle(p)} className="px-2 py-1 border rounded">
                    {rec?.status === 'granted' ? 'Withdraw' : 'Grant'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
