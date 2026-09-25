/**
 * Scholarship administration configuration (issue #1167).
 *
 * Limits, deadlines, providers, assets, templates, and risk thresholds are
 * managed as one validated, versioned document. Changes are permissioned and
 * audited upstream, previewed before they are saved, and secrets are always
 * referenced by id — the configuration returned to the client never contains a
 * secret value.
 */

import { apiClient } from '@/src/lib/api-client';

export type ScholarshipAdminConfig = {
  version: number;
  maxAwardAmount: number;
  maxApplicationsPerApplicant: number;
  reviewSlaHours: number;
  applicationDeadlineDays: number;
  fundingProviders: string[];
  acceptedAssets: string[];
  notificationTemplateKeys: string[];
  riskThresholds: {
    reviewReferralScore: number;
    fraudScore: number;
  };
  /** Secret references only — never the secret itself. */
  webhookSigningSecretRef: string;
  paymentProviderApiKeyRef: string;
  updatedAt: string;
  updatedBy: string;
};

export type AdminConfigChange = {
  field: string;
  from: string;
  to: string;
};

export const DEFAULT_ADMIN_CONFIG: ScholarshipAdminConfig = {
  version: 1,
  maxAwardAmount: 5000,
  maxApplicationsPerApplicant: 3,
  reviewSlaHours: 72,
  applicationDeadlineDays: 30,
  fundingProviders: ['stellar-wave', 'hummingbird-fund'],
  acceptedAssets: ['XLM', 'USDC'],
  notificationTemplateKeys: ['application.received', 'award.granted', 'payout.finalized'],
  riskThresholds: {
    reviewReferralScore: 60,
    fraudScore: 85,
  },
  webhookSigningSecretRef: 'ref:scholarship-webhook-signing',
  paymentProviderApiKeyRef: 'ref:payment-provider-key',
  updatedAt: '2026-09-01T00:00:00.000Z',
  updatedBy: 'platform-engineering',
};

/** Returns a copy where every secret is replaced by its reference. */
export function redactAdminConfig(config: ScholarshipAdminConfig): ScholarshipAdminConfig {
  return {
    ...config,
    webhookSigningSecretRef: 'ref:redacted',
    paymentProviderApiKeyRef: 'ref:redacted',
  };
}

export function validateAdminConfig(config: ScholarshipAdminConfig): string[] {
  const errors: string[] = [];

  if (config.version < 1) errors.push('Configuration version must be a positive integer.');
  if (config.maxAwardAmount <= 0) errors.push('Maximum award amount must be greater than zero.');
  if (config.maxApplicationsPerApplicant < 1 || config.maxApplicationsPerApplicant > 10) {
    errors.push('Applications per applicant must be between 1 and 10.');
  }
  if (config.reviewSlaHours <= 0) errors.push('Review SLA hours must be greater than zero.');
  if (config.applicationDeadlineDays <= 0) {
    errors.push('Application deadline must be greater than zero days.');
  }
  if (config.fundingProviders.length === 0) {
    errors.push('At least one funding provider is required.');
  }
  if (config.acceptedAssets.length === 0) {
    errors.push('At least one accepted asset is required.');
  }
  if (
    config.riskThresholds.reviewReferralScore < 0 ||
    config.riskThresholds.reviewReferralScore > 100 ||
    config.riskThresholds.fraudScore < 0 ||
    config.riskThresholds.fraudScore > 100
  ) {
    errors.push('Risk thresholds must be between 0 and 100.');
  }
  if (!config.webhookSigningSecretRef.trim() || !config.paymentProviderApiKeyRef.trim()) {
    errors.push('Secrets must be referenced by id, not left empty.');
  }

  return errors;
}

export function previewAdminConfigChange(
  current: ScholarshipAdminConfig,
  next: ScholarshipAdminConfig
): AdminConfigChange[] {
  const changes: AdminConfigChange[] = [];
  const keys = Object.keys(current) as (keyof ScholarshipAdminConfig)[];

  for (const key of keys) {
    if (key === 'updatedAt' || key === 'updatedBy') continue;
    const before = current[key];
    const after = next[key];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      changes.push({
        field: key,
        from: typeof before === 'object' ? JSON.stringify(before) : String(before),
        to: typeof after === 'object' ? JSON.stringify(after) : String(after),
      });
    }
  }

  return changes;
}

export const scholarshipAdminConfigService = {
  get: (): Promise<ScholarshipAdminConfig> =>
    apiClient.get<ScholarshipAdminConfig>('/scholarships/admin/config'),

  preview: (next: ScholarshipAdminConfig): Promise<AdminConfigChange[]> =>
    apiClient.post<AdminConfigChange[]>('/scholarships/admin/config/preview', next),

  save: (next: ScholarshipAdminConfig): Promise<ScholarshipAdminConfig> =>
    apiClient.post<ScholarshipAdminConfig>('/scholarships/admin/config', next),
};
