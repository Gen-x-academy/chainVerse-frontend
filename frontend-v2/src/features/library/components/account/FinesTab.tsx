'use client';

import React, { useCallback } from 'react';
import { Wallet } from 'lucide-react';
import { StellarFinePayment } from '@/components/elibrary/StellarFinePayment';
import { FinesLedger } from '@/components/elibrary/FinesLedger';
import { useFinesLedger, useOutstandingFines, usePayFines } from '../../hooks/usePatronAccount';
import type { AccountLedgerEntry } from '../../types/account.types';
import type { FinesLedgerEntry } from '@/components/elibrary/FinesLedger';

export interface FinesTabProps {
  patronId?: string;
}

function toLedgerEntry(entry: AccountLedgerEntry): FinesLedgerEntry {
  return {
    id: entry.id,
    type: entry.kind,
    amount: entry.amountCents / 100,
    createdAt: entry.createdAt,
    reference: entry.reference,
  };
}

export function FinesTab({ patronId }: FinesTabProps) {
  const finesQuery = useOutstandingFines(patronId);
  const ledgerQuery = useFinesLedger(patronId);
  const payFines = usePayFines(patronId);

  const fines = finesQuery.data ?? [];
  const totalCents = fines.reduce((sum, fine) => sum + fine.amountCents, 0);
  const currency = fines[0]?.currency ?? 'USD';

  const handlePay = useCallback(async () => {
    const result = await payFines.mutateAsync();
    if (result.success && result.txHash) {
      return { txHash: result.txHash };
    }
    throw new Error(result.error ?? 'Payment failed');
  }, [payFines]);

  return (
    <div className="space-y-6">
      {finesQuery.isLoading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6" aria-busy="true" aria-label="Loading fines">
          <div className="flex justify-between">
            <div className="h-6 w-40 animate-pulse rounded bg-gray-200" />
            <div className="h-10 w-32 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      ) : finesQuery.isError ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <p className="font-medium">Fines unavailable</p>
          <p className="mt-1 text-sm">
            {finesQuery.error instanceof Error
              ? finesQuery.error.message
              : 'Unable to load your outstanding fines.'}
          </p>
        </div>
      ) : totalCents > 0 ? (
        <StellarFinePayment amountDue={totalCents / 100} onPay={handlePay} />
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white py-10 text-center" role="status">
          <Wallet className="mx-auto mb-2 h-8 w-8 text-gray-300" aria-hidden="true" />
          <p className="text-gray-500">You have no outstanding fines. Balances use {currency}.</p>
        </div>
      )}

      <FinesLedger
        entries={(ledgerQuery.data ?? []).map(toLedgerEntry)}
        isLoading={ledgerQuery.isLoading}
        error={
          ledgerQuery.isError
            ? ledgerQuery.error instanceof Error
              ? ledgerQuery.error.message
              : undefined
            : undefined
        }
      />
    </div>
  );
}