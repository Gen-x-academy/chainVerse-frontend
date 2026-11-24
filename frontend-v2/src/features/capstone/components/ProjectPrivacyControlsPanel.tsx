'use client';

import React, { useId, useState } from 'react';
import {
  AUDIENCES,
  AUDIENCE_DEFINITIONS,
  CATEGORY_DEFINITIONS,
  FIELD_CATEGORIES,
  initializeProjectPrivacy,
  isConsequentialPrivacyChange,
  updateFieldPrivacy,
  type Audience,
  type FieldCategory,
  type PrivacyActor,
  type ProjectPrivacyPolicy,
} from '../field-privacy';
import {
  CapstoneConflictState,
  CapstoneConfirmationModal,
  CapstoneErrorState,
  CapstoneLoadingState,
  CapstonePermissionDeniedState,
  CapstoneSuccessState,
} from './CapstoneSharedStates';

export interface ProjectPrivacyControlsPanelProps {
  projectId: string;
  organizationId: string;
  actor: PrivacyActor;
  initialPolicy?: ProjectPrivacyPolicy;
  onPolicyChanged?: (policy: ProjectPrivacyPolicy) => void;
}

export function ProjectPrivacyControlsPanel({
  projectId,
  organizationId,
  actor,
  initialPolicy,
  onPolicyChanged,
}: ProjectPrivacyControlsPanelProps) {
  const headingId = useId();
  const [policy, setPolicy] = useState<ProjectPrivacyPolicy>(() => {
    return (
      initialPolicy ??
      initializeProjectPrivacy(projectId, organizationId, new Date().toISOString(), actor.id)
    );
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const [pendingPublicConfirmation, setPendingPublicConfirmation] = useState<{
    category: FieldCategory;
    newAudience: Audience;
    warning: string;
  } | null>(null);

  const isAuthorized =
    actor.organizationId === organizationId &&
    (Boolean(actor.isProjectOwner) ||
      Boolean(actor.isSupervisor) ||
      actor.role === 'administrator' ||
      actor.role === 'organization_staff');

  if (!isAuthorized) {
    return (
      <CapstonePermissionDeniedState
        message="Only project owners, supervisors, and authorized organization administrators can modify field-level privacy settings."
      />
    );
  }

  const handleApplyAudienceChange = (category: FieldCategory, newAudience: Audience) => {
    setIsLoading(true);
    setErrorMessage(null);
    setConflictMessage(null);
    setSuccessNotice(null);

    const now = new Date().toISOString();
    const requestId = `req_privacy_${category}_${Date.now()}`;

    const result = updateFieldPrivacy(policy, {
      requestId,
      projectId,
      organizationId,
      category,
      newAudience,
      expectedRevision: policy.revision,
      actor,
      now,
    });

    if (result.ok) {
      setPolicy(result.value);
      setSuccessNotice(`Updated visibility for ${CATEGORY_DEFINITIONS[category].name} to ${AUDIENCE_DEFINITIONS[newAudience].label}.`);
      onPolicyChanged?.(result.value);
    } else if (result.code === 'STALE_REVISION') {
      setConflictMessage('Privacy controls were modified by another team member.');
    } else {
      setErrorMessage(result.message);
    }

    setIsLoading(false);
    setPendingPublicConfirmation(null);
  };

  const handleAudienceSelection = (category: FieldCategory, selectedAudience: Audience) => {
    const currentSetting = policy.settings[category];
    const check = isConsequentialPrivacyChange(category, currentSetting.effectiveAudience, selectedAudience);

    if (check.isConsequential && check.warning) {
      setPendingPublicConfirmation({
        category,
        newAudience: selectedAudience,
        warning: check.warning,
      });
    } else {
      handleApplyAudienceChange(category, selectedAudience);
    }
  };

  return (
    <div className="space-y-6" aria-labelledby={headingId}>
      <header className="border-b border-gray-200 pb-4">
        <h2 id={headingId} className="text-xl font-bold text-gray-900">
          Field-Level Privacy Controls
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Control which audiences can view individual project fields and artifacts.
          Privacy settings are enforced deny-by-default on all API boundaries.
        </p>
      </header>

      {isLoading && <CapstoneLoadingState label="Saving privacy policy…" />}
      {errorMessage && <CapstoneErrorState message={errorMessage} onRetry={() => setErrorMessage(null)} />}
      {conflictMessage && (
        <CapstoneConflictState
          message={conflictMessage}
          onRefresh={() => {
            setConflictMessage(null);
            setPolicy(initializeProjectPrivacy(projectId, organizationId, new Date().toISOString(), actor.id));
          }}
        />
      )}
      {successNotice && <CapstoneSuccessState>{successNotice}</CapstoneSuccessState>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {FIELD_CATEGORIES.map((category) => {
          const def = CATEGORY_DEFINITIONS[category];
          const setting = policy.settings[category];
          const currentAudience = setting?.effectiveAudience ?? def.defaultAudience;
          const isLocked = Boolean(setting?.isLocked);

          return (
            <article
              key={category}
              className="flex flex-col justify-between rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-gray-900">{def.name}</h3>
                  {isLocked && (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                      Policy Locked
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-600">{def.description}</p>

                {isLocked && setting?.lockReason && (
                  <div className="rounded bg-amber-50 p-2 text-xs text-amber-900">
                    <span className="font-semibold">Reason:</span> {setting.lockReason}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
                <label
                  htmlFor={`audience-select-${category}`}
                  className="block text-xs font-medium text-gray-700"
                >
                  Current Visibility
                </label>
                <select
                  id={`audience-select-${category}`}
                  value={currentAudience}
                  disabled={isLocked || isLoading}
                  onChange={(e) => handleAudienceSelection(category, e.target.value as Audience)}
                  className="w-full rounded-md border border-gray-300 bg-white py-1.5 px-3 text-sm font-medium text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                >
                  {def.allowedAudiences.map((aud) => (
                    <option key={aud} value={aud}>
                      {AUDIENCE_DEFINITIONS[aud].label}
                    </option>
                  ))}
                </select>

                <p className="text-xs text-gray-500">
                  {AUDIENCE_DEFINITIONS[currentAudience].description}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      <CapstoneConfirmationModal
        isOpen={Boolean(pendingPublicConfirmation)}
        title="Public Visibility Warning"
        description={
          pendingPublicConfirmation?.warning ??
          'Broadening this setting may expose previously private information to the public.'
        }
        confirmLabel="Make Public"
        isDestructive={false}
        onConfirm={() => {
          if (pendingPublicConfirmation) {
            handleApplyAudienceChange(
              pendingPublicConfirmation.category,
              pendingPublicConfirmation.newAudience
            );
          }
        }}
        onCancel={() => setPendingPublicConfirmation(null)}
      />
    </div>
  );
}
