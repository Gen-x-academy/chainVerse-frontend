'use client';

import React, { useEffect, useId, useState } from 'react';
import {
  CLASSIFICATION_LEVELS,
  MASKED_PLACEHOLDER,
  rotateProjectSecret,
  SENSITIVE_CATEGORIES,
  SENSITIVE_DEFINITIONS,
  canManageSecrets,
  type ProjectSecretItem,
  type SecretActor,
  type SensitiveCategory,
} from '../secrets-protection';
import {
  CapstoneConflictState,
  CapstoneConfirmationModal,
  CapstoneErrorState,
  CapstoneLoadingState,
  CapstonePermissionDeniedState,
  CapstoneSuccessState,
  MaskedValueViewer,
} from './CapstoneSharedStates';

export interface ProjectSecretsPanelProps {
  projectId: string;
  organizationId: string;
  actor: SecretActor;
  initialSecrets?: ProjectSecretItem[];
  onSecretRotated?: (secret: ProjectSecretItem) => void;
}

export function ProjectSecretsPanel({
  projectId,
  organizationId,
  actor,
  initialSecrets,
  onSecretRotated,
}: ProjectSecretsPanelProps) {
  const headingId = useId();

  const [secrets, setSecrets] = useState<ProjectSecretItem[]>(() => {
    if (initialSecrets && initialSecrets.length > 0) return initialSecrets;
    const now = new Date().toISOString();
    return SENSITIVE_CATEGORIES.map((cat, idx) => ({
      id: `sec_${projectId}_${cat}`,
      projectId,
      organizationId,
      category: cat,
      name: SENSITIVE_DEFINITIONS[cat].name,
      maskedValue: MASKED_PLACEHOLDER,
      classification: SENSITIVE_DEFINITIONS[cat].classification,
      keyVersion: 1,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      status: 'active' as const,
    }));
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Transient secret entry in modal, ephemeral and cleared on close/unmount
  const [isNewSecretModalOpen, setIsNewSecretModalOpen] = useState(false);
  const [newSecretCategory, setNewSecretCategory] = useState<SensitiveCategory>('provider_tokens');
  const [transientSecretValue, setTransientSecretValue] = useState('');

  const [pendingRotation, setPendingRotation] = useState<{
    secret: ProjectSecretItem;
    impact: string;
  } | null>(null);

  // Ensure transient secrets are never retained when modal closes
  useEffect(() => {
    if (!isNewSecretModalOpen) {
      setTransientSecretValue('');
    }
  }, [isNewSecretModalOpen]);

  // Clean up transient state on unmount
  useEffect(() => {
    return () => {
      setTransientSecretValue('');
    };
  }, []);

  const isAuthorized =
    actor.organizationId === organizationId &&
    (actor.isProjectOwner || actor.role === 'administrator');

  if (!isAuthorized) {
    return (
      <CapstonePermissionDeniedState
        message="Only project owners and authorized security administrators can inspect or rotate project secrets."
      />
    );
  }

  const handleExecuteRotation = (secret: ProjectSecretItem) => {
    setIsLoading(true);
    setErrorMessage(null);
    setConflictMessage(null);
    setSuccessNotice(null);

    const now = new Date().toISOString();
    const requestId = `req_rot_${secret.id}_${Date.now()}`;

    const result = rotateProjectSecret(secrets, {
      requestId,
      secretId: secret.id,
      projectId,
      organizationId,
      actor,
      now,
      expectedRevision: secret.revision,
    });

    if (result.ok) {
      setSecrets((prev) =>
        prev.map((s) => (s.id === result.value.id ? result.value : s))
      );
      setSuccessNotice(
        `Successfully rotated ${secret.name} (Key Version ${result.value.keyVersion}). Old credentials have been invalidated.`
      );
      onSecretRotated?.(result.value);
    } else if (result.code === 'STALE_REVISION') {
      setConflictMessage(`The secret record for ${secret.name} was updated by another administrator.`);
    } else {
      setErrorMessage(result.message);
    }

    setIsLoading(false);
    setPendingRotation(null);
  };

  const getClassificationBadge = (classification: string) => {
    switch (classification) {
      case 'secret':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'confidential':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'restricted':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6" aria-labelledby={headingId}>
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-4">
        <div>
          <h2 id={headingId} className="text-xl font-bold text-gray-900">
            Project Secrets & Sensitive-Field Protection
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Manage provider tokens, sensitive notes, and evidence keys.
            Encryption is enforced at rest on the backend; secrets are masked by default.
          </p>
        </div>
      </header>

      {isLoading && <CapstoneLoadingState label="Rotating cryptographic key…" />}
      {errorMessage && <CapstoneErrorState message={errorMessage} onRetry={() => setErrorMessage(null)} />}
      {conflictMessage && (
        <CapstoneConflictState
          message={conflictMessage}
          onRefresh={() => setConflictMessage(null)}
        />
      )}
      {successNotice && <CapstoneSuccessState>{successNotice}</CapstoneSuccessState>}

      <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
        {secrets.map((item) => {
          const def = SENSITIVE_DEFINITIONS[item.category];
          const canRotate = def?.supportsRotation && canManageSecrets(actor, item.category);

          return (
            <article
              key={item.id}
              className="p-5 transition-colors hover:bg-gray-50/50 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-gray-900">{item.name}</h3>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase ${getClassificationBadge(
                      item.classification
                    )}`}
                  >
                    {item.classification}
                  </span>
                  <span className="text-xs text-gray-400">
                    Version {item.keyVersion} • Rev {item.revision}
                  </span>
                </div>

                <p className="text-sm text-gray-600">{def?.description}</p>

                <div className="flex items-center gap-3 pt-1">
                  <span className="text-xs font-medium text-gray-500">Stored Value:</span>
                  <MaskedValueViewer
                    value={item.maskedValue}
                    isMaskedByDefault={true}
                    canReveal={false} // Plaintext reveal is disabled by default to prevent leakage
                  />
                </div>

                {item.lastRotatedAt && (
                  <p className="text-xs text-gray-400">
                    Last rotated: {new Date(item.lastRotatedAt).toLocaleString()}
                  </p>
                )}
              </div>

              {canRotate && (
                <div className="shrink-0 pt-2 sm:pt-0">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() =>
                      setPendingRotation({
                        secret: item,
                        impact:
                          def?.rotationImpact ??
                          'Rotating this key will invalidate older active connections.',
                      })
                    }
                    className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
                  >
                    Rotate Key
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <CapstoneConfirmationModal
        isOpen={Boolean(pendingRotation)}
        title="Confirm Key Rotation"
        description={
          pendingRotation
            ? `Are you sure you want to rotate ${pendingRotation.secret.name}? ${pendingRotation.impact}`
            : ''
        }
        confirmLabel="Rotate Secret"
        isDestructive={true}
        onConfirm={() => {
          if (pendingRotation) {
            handleExecuteRotation(pendingRotation.secret);
          }
        }}
        onCancel={() => setPendingRotation(null)}
      />
    </div>
  );
}
