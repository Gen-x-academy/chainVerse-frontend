'use client';

import React, { useCallback, useState } from 'react';
import { CirculationDesk } from '@/components/elibrary/CirculationDesk';
import { LibrarianLayout } from '@/components/elibrary/LibrarianLayout';
import {
  mockLookupCopy,
  mockScanBarcode,
} from '@/src/features/library/utils/mockLibraryData';
import type { CopyDetail, ScanMode } from '@/src/features/library/types/library.types';

export default function CirculationPage() {
  const [mode, setMode] = useState<ScanMode>('checkout');
  const [copyDetail, setCopyDetail] = useState<CopyDetail | null>(null);
  const [copyLoading, setCopyLoading] = useState(false);
  const [lastScanMessage, setLastScanMessage] = useState<string | null>(null);

  const handleScan = useCallback(async (barcode: string, scanMode: ScanMode) => {
    const result = mockScanBarcode(barcode, scanMode);
    if (result.duplicate) {
      setLastScanMessage('Duplicate scan — item already checked out.');
      return { success: false, duplicate: true };
    }
    if (result.success && result.copy) {
      setCopyDetail(result.copy);
      setLastScanMessage(`Scan accepted for ${result.copy.title}`);
      return { success: true };
    }
    setLastScanMessage(result.error ?? 'Scan failed');
    return { success: false, error: result.error };
  }, []);

  const handleManualLookup = useCallback((query: string) => {
    setCopyLoading(true);
    const copy = mockLookupCopy(query);
    setCopyDetail(copy);
    setCopyLoading(false);
    if (!copy) setLastScanMessage('No copy found for that barcode.');
  }, []);

  return (
    <LibrarianLayout
      permissions={['circulation']}
      activeHref="/library/circulation"
      title="Circulation desk"
    >
      <CirculationDesk
        mode={mode}
        onModeChange={setMode}
        copyDetail={copyDetail}
        copyLoading={copyLoading}
        lastScanMessage={lastScanMessage}
        onScan={handleScan}
        onManualLookup={handleManualLookup}
      />
    </LibrarianLayout>
  );
}
