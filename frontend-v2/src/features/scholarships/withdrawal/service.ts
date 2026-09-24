import type { WithdrawalRecord, WithdrawalRequest } from './types';

const WITHDRAWAL_PATH = '/scholarship-withdrawals';

export function getWithdrawalPolicyImpact(request: WithdrawalRequest): string {
  const category = request.reasonCategory;

  if (category === 'financial' || category === 'schedule') {
    return 'Capacity is released immediately because the withdrawal is not tied to an active award commitment.';
  }

  if (category === 'academic' || category === 'personal') {
    return 'Review history remains intact, and capacity is released only after administrative approval.';
  }

  return 'Withdrawal is recorded with a full audit trail; any capacity release requires final review by the program team.';
}

export async function submitWithdrawal(request: WithdrawalRequest): Promise<WithdrawalRecord> {
  const confirmation = request.confirmed && !!request.applicationId && !!request.programId;
  if (!confirmation) {
    throw new Error('Withdrawal must be confirmed before submission.');
  }

  const record: WithdrawalRecord = {
    withdrawalId: `withdrawal-${Date.now().toString(36)}`,
    applicationId: request.applicationId,
    programId: request.programId,
    reasonCategory: request.reasonCategory,
    reasonDetail: request.reasonDetail,
    confirmed: true,
    requestedAt: request.requestedAt ?? new Date().toISOString(),
    status: 'pending',
    releasedCapacity: request.reasonCategory === 'financial' || request.reasonCategory === 'schedule',
    reviewHistoryPreserved: true,
    policyImpact: getWithdrawalPolicyImpact(request),
  };

  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
  if (!baseUrl) {
    return record;
  }

  try {
    const response = await fetch(`${baseUrl}${WITHDRAWAL_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });

    if (!response.ok) {
      return record;
    }

    const data = (await response.json()) as Partial<WithdrawalRecord>;
    return { ...record, ...data };
  } catch {
    return record;
  }
}

export const scholarshipWithdrawalService = {
  submitWithdrawal,
  getWithdrawalPolicyImpact,
};
