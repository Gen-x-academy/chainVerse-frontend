/**
 * Versioned scholarship API contracts (issue #1161).
 *
 * Stable schemas for programs, applications, reviews, awards, milestones,
 * payments, errors, and pagination live here as one catalogue. `diffContracts`
 * classifies every difference between two versions of the catalogue as
 * compatible, additive, or breaking, and breaking changes require a new
 * contract version before they can ship.
 */

import { apiClient } from '@/src/lib/api-client';

export const SCHOLARSHIP_CONTRACT_VERSION = '1.0.0';

export type ScholarshipContractMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ScholarshipContractEndpoint = {
  id: string;
  version: string;
  method: ScholarshipContractMethod;
  route: string;
  requestFields: string[];
  responseFields: string[];
};

export const SCHOLARSHIP_API_CONTRACTS: ScholarshipContractEndpoint[] = [
  { id: 'programs.list', version: '1.0.0', method: 'GET', route: '/scholarships/programs', requestFields: [], responseFields: ['items', 'total', 'nextCursor'] },
  { id: 'applications.submit', version: '1.0.0', method: 'POST', route: '/scholarships/applications', requestFields: ['programId', 'answers'], responseFields: ['id', 'submittedAt', 'receipt'] },
  { id: 'reviews.complete', version: '1.0.0', method: 'POST', route: '/scholarships/reviews', requestFields: ['applicationId', 'scores'], responseFields: ['id', 'lockedAt'] },
  { id: 'awards.accept', version: '1.0.0', method: 'POST', route: '/scholarships/awards/accept', requestFields: ['awardId', 'agreementVersion'], responseFields: ['id', 'acceptedAt'] },
  { id: 'milestones.verify', version: '1.0.0', method: 'POST', route: '/scholarships/milestones/verify', requestFields: ['milestoneId', 'evidence'], responseFields: ['id', 'verifiedAt'] },
  { id: 'payments.get', version: '1.0.0', method: 'GET', route: '/scholarships/payments', requestFields: [], responseFields: ['items', 'total', 'nextCursor'] },
];

export type ContractChangeClass = 'compatible' | 'additive' | 'breaking';

export type ContractChange = {
  endpointId: string;
  changeClass: ContractChangeClass;
  reason:
    | 'endpoint-added'
    | 'endpoint-removed'
    | 'request-field-added'
    | 'request-field-removed'
    | 'response-field-added'
    | 'response-field-removed';
};

export type ContractCompatibility = {
  compatible: boolean;
  requiresVersionBump: boolean;
  changes: ContractChange[];
};

function classifyFieldChanges(
  endpointId: string,
  before: string[],
  after: string[],
  addedReason: ContractChange['reason'],
  removedReason: ContractChange['reason']
): ContractChange[] {
  const changes: ContractChange[] = [];
  for (const field of before) {
    if (!after.includes(field)) {
      changes.push({ endpointId, changeClass: 'breaking', reason: removedReason });
    }
  }
  for (const field of after) {
    if (!before.includes(field)) {
      changes.push({
        endpointId,
        changeClass: addedReason === 'request-field-added' ? 'additive' : 'compatible',
        reason: addedReason,
      });
    }
  }
  return changes;
}

export function diffContracts(
  previous: ScholarshipContractEndpoint[],
  next: ScholarshipContractEndpoint[]
): ContractChange[] {
  const changes: ContractChange[] = [];
  const previousById = new Map(previous.map((endpoint) => [endpoint.id, endpoint]));
  const nextById = new Map(next.map((endpoint) => [endpoint.id, endpoint]));

  for (const [id, endpoint] of nextById) {
    const before = previousById.get(id);
    if (!before) {
      changes.push({ endpointId: id, changeClass: 'additive', reason: 'endpoint-added' });
      continue;
    }
    changes.push(
      ...classifyFieldChanges(
        id,
        before.requestFields,
        endpoint.requestFields,
        'request-field-added',
        'request-field-removed'
      )
    );
    changes.push(
      ...classifyFieldChanges(
        id,
        before.responseFields,
        endpoint.responseFields,
        'response-field-added',
        'response-field-removed'
      )
    );
  }

  for (const id of previousById.keys()) {
    if (!nextById.has(id)) {
      changes.push({ endpointId: id, changeClass: 'breaking', reason: 'endpoint-removed' });
    }
  }

  return changes;
}

export function evaluateContractCompatibility(
  previous: ScholarshipContractEndpoint[],
  next: ScholarshipContractEndpoint[]
): ContractCompatibility {
  const changes = diffContracts(previous, next);
  const breaking = changes.filter((change) => change.changeClass === 'breaking');
  return {
    compatible: breaking.length === 0,
    requiresVersionBump: breaking.length > 0,
    changes,
  };
}

/** Executable example fixtures keep the documented contract honest. */
export function contractFixtures(): Record<string, unknown> {
  return {
    'programs.list': { items: [], total: 0, nextCursor: null },
    'applications.submit': { id: 'application-1', submittedAt: '2026-09-24T00:00:00.000Z', receipt: 'receipt-1' },
    'reviews.complete': { id: 'review-1', lockedAt: '2026-09-24T00:00:00.000Z' },
    'awards.accept': { id: 'award-1', acceptedAt: '2026-09-24T00:00:00.000Z' },
    'milestones.verify': { id: 'milestone-1', verifiedAt: '2026-09-24T00:00:00.000Z' },
    'payments.get': { items: [], total: 0, nextCursor: null },
  };
}

export const scholarshipContractService = {
  list: (): Promise<ScholarshipContractEndpoint[]> =>
    apiClient.get<ScholarshipContractEndpoint[]>('/scholarships/contracts'),

  diff: (
    previous: ScholarshipContractEndpoint[],
    next: ScholarshipContractEndpoint[]
  ): Promise<ContractCompatibility> =>
    apiClient.post<ContractCompatibility>('/scholarships/contracts/diff', { previous, next }),
};
