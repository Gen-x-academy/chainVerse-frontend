'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { MergeFieldDecision, MergePreview } from '@/src/features/library/types/catalog.types';

interface CatalogMergePanelProps {
  preview: MergePreview | null;
  isPreviewLoading?: boolean;
  previewError?: string | null;
  onPreview: () => Promise<void>;
  onMerge: () => Promise<{ redirectUrl: string }>;
  disabled?: boolean;
}

/** #927: Merge confirmation panel with preview and commit */
export function CatalogMergePanel({
  preview,
  isPreviewLoading,
  previewError,
  onPreview,
  onMerge,
  disabled,
}: CatalogMergePanelProps) {
  const [step, setStep] = useState<'idle' | 'previewing' | 'confirming' | 'merging' | 'success' | 'error'>('idle');
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  const handlePreview = async () => {
    setStep('previewing');
    setErrorMessage(null);
    try {
      await onPreview();
      setStep('confirming');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Preview failed');
      setStep('error');
    }
  };

  const handleMerge = async () => {
    if (!confirmChecked) return;
    setStep('merging');
    setErrorMessage(null);
    try {
      const result = await onMerge();
      setRedirectUrl(result.redirectUrl);
      setStep('success');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Merge failed');
      setStep('error');
    }
  };

  if (step === 'success' && redirectUrl) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-4">
          <p className="text-sm text-green-700 font-medium">Records merged successfully.</p>
          <a
            href={redirectUrl}
            className="inline-flex items-center text-sm font-medium text-indigo-600 hover:underline"
          >
            View canonical record →
          </a>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Merge records</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {previewError && (
          <div role="alert" className="text-sm text-destructive">{previewError}</div>
        )}
        {errorMessage && (
          <div role="alert" className="text-sm text-destructive">{errorMessage}</div>
        )}

        {preview && step === 'confirming' && (
          <div className="rounded-md border p-4 space-y-2 text-sm">
            <p className="font-medium">Merge preview</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>{preview.holdingsToReassign} holdings will be reassigned</li>
              <li>{preview.loansToTransfer} active loans will transfer</li>
              <li>{preview.holdsToTransfer} pending holds will transfer</li>
            </ul>
            {preview.warnings.length > 0 && (
              <div className="mt-2 text-amber-700">
                <p className="font-medium">Warnings</p>
                <ul className="list-disc pl-5">
                  {preview.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            <label className="flex items-start gap-2 mt-4 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
                className="mt-1"
              />
              <span>
                I understand this merge is irreversible. Non-canonical records will be removed
                and their holdings, loans, and holds transferred.
              </span>
            </label>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          {step !== 'confirming' && (
            <Button
              type="button"
              onClick={handlePreview}
              disabled={disabled || isPreviewLoading || step === 'previewing'}
            >
              {step === 'previewing' || isPreviewLoading ? 'Generating preview…' : 'Preview merge'}
            </Button>
          )}
          {step === 'confirming' && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setStep('idle'); setConfirmChecked(false); }}
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={handleMerge}
                disabled={!confirmChecked || step === 'merging'}
              >
                {step === 'merging' ? 'Merging…' : 'Confirm merge'}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export type { MergeFieldDecision };
