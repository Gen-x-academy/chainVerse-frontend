'use client';

import React, { useCallback } from 'react';
import { LoanRenewalControls } from '@/components/elibrary/LoanRenewalControls';
import { useCurrentLoans, useRenewLoan } from '../../hooks/usePatronAccount';
import type { AccountLoan } from '../../types/account.types';
import type { RenewalState } from '@/components/elibrary/LoanRenewalControls';

export interface CurrentLoansTabProps {
  patronId?: string;
}

function toRenewalState(loan: AccountLoan): RenewalState {
  return {
    id: loan.id,
    title: loan.title,
    currentDueDate: loan.currentDueDate,
    newDueDatePreview: loan.newDueDatePreview,
    renewalsUsed: loan.renewalsUsed,
    maxRenewals: loan.maxRenewals,
    isOverdue: loan.isOverdue,
    canRenew: loan.canRenew,
    blockReason: loan.blockReason,
    blockMessage: loan.blockMessage,
  };
}

export function CurrentLoansTab({ patronId }: CurrentLoansTabProps) {
  const { data, isLoading, isError, error } = useCurrentLoans(patronId);
  const renewLoan = useRenewLoan(patronId);

  const handleRenew = useCallback(
    async (loanId: string) => {
      try {
        const result = await renewLoan.mutateAsync(loanId);
        return result;
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Renewal failed. Please try again.',
        };
      }
    },
    [renewLoan]
  );

  return (
    <LoanRenewalControls
      loans={(data ?? []).map(toRenewalState)}
      isLoading={isLoading}
      error={
        isError
          ? error instanceof Error
            ? error.message
            : 'Failed to load your current loans.'
          : null
      }
      onRenew={handleRenew}
    />
  );
}