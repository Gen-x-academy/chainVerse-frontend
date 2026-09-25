'use client';

import { useEffect, useId, useState } from 'react';
import { walletValidationService } from '../service';
import type { ChallengeStatus, WalletChallenge, WalletValidationResult } from '../types';

type FlowStep = 'idle' | 'requesting' | 'awaiting_signature' | 'submitting' | 'verified' | 'error' | 'expired';

type Props = {
  recipientId: string;
  walletAddress: string;
  onVerified?: (result: WalletValidationResult) => void;
  onAddressChange?: (newAddress: string) => void;
};

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export function WalletOwnershipValidator({ recipientId, walletAddress, onVerified, onAddressChange }: Props) {
  const formId = useId();
  const [step, setStep] = useState<FlowStep>('idle');
  const [challenge, setChallenge] = useState<WalletChallenge | null>(null);
  const [signature, setSignature] = useState('');
  const [publicKey, setPublicKey] = useState(walletAddress);
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState<WalletValidationResult | null>(null);
  const [newAddress, setNewAddress] = useState('');
  const [showAddressChange, setShowAddressChange] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isSubmittingSignature, setIsSubmittingSignature] = useState(false);
  const statusRegionId = `${formId}-status`;

  useEffect(() => {
    if (!challenge || step !== 'awaiting_signature') return;

    const expiresAt = new Date(challenge.expiresAt).getTime();

    const tick = () => {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        setTimeLeft(0);
        setStep('expired');
        return;
      }
      setTimeLeft(Math.ceil(remaining / 1000));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [challenge, step]);

  const handleRequestChallenge = async () => {
    setStep('requesting');
    setErrorMessage('');

    try {
      const ch = await walletValidationService.requestChallenge(walletAddress);
      setChallenge(ch);
      setStep('awaiting_signature');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to request challenge. Please try again.');
      setStep('error');
    }
  };

  const handleSubmitSignature = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!challenge || !signature.trim()) return;

    setIsSubmittingSignature(true);
    setStep('submitting');
    setErrorMessage('');

    try {
      const validation = await walletValidationService.submitSignature({
        challengeId: challenge.challengeId,
        walletAddress,
        signature: signature.trim(),
        publicKey: publicKey.trim() || walletAddress,
      });

      setResult(validation);
      setStep('verified');
      onVerified?.(validation);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Signature verification failed. Please try again.');
      setStep('error');
    } finally {
      setIsSubmittingSignature(false);
    }
  };

  const handleAddressChange = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newAddress.trim()) return;

    setStep('requesting');
    setErrorMessage('');

    try {
      const validation = await walletValidationService.updateWalletAddress({
        recipientId,
        newWalletAddress: newAddress.trim(),
      });

      setResult(validation);
      setStep('verified');
      onAddressChange?.(newAddress.trim());
      onVerified?.(validation);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Address update failed. Please try again.');
      setStep('error');
    }
  };

  const handleRetry = () => {
    setStep('idle');
    setChallenge(null);
    setSignature('');
    setErrorMessage('');
    setTimeLeft(null);
  };

  if (!recipientId || !walletAddress) {
    return (
      <section
        aria-label="Wallet ownership validation"
        className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
        role="alert"
      >
        A recipient ID and wallet address are required to validate wallet ownership.
      </section>
    );
  }

  return (
    <section
      aria-label="Wallet ownership validation"
      className="mx-auto w-full max-w-2xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
          Wallet verification
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Validate payout wallet ownership
        </h2>
        <p className="text-sm text-slate-500">
          Confirm you control the configured Stellar address before first payment or address change.
          Challenges expire after 5 minutes.
        </p>
      </header>

      <div
        id={statusRegionId}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {step === 'requesting' && 'Requesting ownership challenge…'}
        {step === 'awaiting_signature' && `Challenge ready. ${timeLeft !== null ? `Expires in ${timeLeft} seconds.` : ''}`}
        {step === 'submitting' && 'Verifying signature…'}
        {step === 'verified' && 'Wallet ownership verified.'}
        {step === 'expired' && 'Challenge expired. Please request a new one.'}
        {step === 'error' && `Error: ${errorMessage}`}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <p className="font-medium text-slate-900">Wallet address</p>
        <p className="mt-1 break-all font-mono text-xs text-slate-600">{walletAddress}</p>
      </div>

      {step === 'idle' && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={handleRequestChallenge}
            className="w-full rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Request ownership challenge
          </button>
          <button
            type="button"
            onClick={() => setShowAddressChange((v) => !v)}
            className="w-full rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            aria-expanded={showAddressChange}
          >
            {showAddressChange ? 'Cancel address change' : 'Change wallet address'}
          </button>

          {showAddressChange && (
            <form onSubmit={handleAddressChange} className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">
                Changing your wallet address will place all pending payments on hold until the new
                address is verified.
              </p>
              <div className="space-y-2">
                <label
                  htmlFor={`${formId}-new-address`}
                  className="block text-sm font-medium text-amber-900"
                >
                  New Stellar address
                  <span className="ml-1 text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id={`${formId}-new-address`}
                  type="text"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  required
                  aria-required="true"
                  className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="G…"
                />
              </div>
              <button
                type="submit"
                disabled={!newAddress.trim()}
                className="w-full rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Update address and hold pending payments
              </button>
            </form>
          )}
        </div>
      )}

      {step === 'requesting' && (
        <div role="status" aria-live="polite" className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Requesting challenge from the server…
        </div>
      )}

      {step === 'awaiting_signature' && challenge && (
        <div className="space-y-4">
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-indigo-900">Challenge text</p>
              {timeLeft !== null && (
                <span
                  className={`text-xs font-medium tabular-nums ${timeLeft < 60 ? 'text-red-600' : 'text-indigo-600'}`}
                  aria-label={`Expires in ${timeLeft} seconds`}
                >
                  {timeLeft}s
                </span>
              )}
            </div>
            <p className="break-all font-mono text-xs text-indigo-800">{challenge.challengeText}</p>
            <p className="mt-2 text-xs text-indigo-600">
              Sign this text with your Stellar wallet (domain-separated) then paste the signature below.
            </p>
          </div>

          <form onSubmit={handleSubmitSignature} aria-describedby={statusRegionId} noValidate>
            <fieldset className="space-y-4" disabled={isSubmittingSignature}>
              <legend className="sr-only">Submit wallet signature</legend>

              <div className="space-y-2">
                <label
                  htmlFor={`${formId}-pubkey`}
                  className="block text-sm font-medium text-slate-700"
                >
                  Public key used to sign
                </label>
                <input
                  id={`${formId}-pubkey`}
                  type="text"
                  value={publicKey}
                  onChange={(e) => setPublicKey(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="G…"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor={`${formId}-sig`}
                  className="block text-sm font-medium text-slate-700"
                >
                  Signature (base64)
                  <span className="ml-1 text-red-500" aria-hidden="true">*</span>
                </label>
                <textarea
                  id={`${formId}-sig`}
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  rows={3}
                  required
                  aria-required="true"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Base64-encoded signature…"
                />
              </div>

              <button
                type="submit"
                disabled={!signature.trim()}
                className="w-full rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                aria-busy={isSubmittingSignature}
              >
                Verify signature
              </button>
            </fieldset>
          </form>
        </div>
      )}

      {step === 'submitting' && (
        <div role="status" aria-live="polite" className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Verifying signature…
        </div>
      )}

      {step === 'expired' && (
        <div className="space-y-4">
          <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            The challenge has expired. Please request a new one.
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="w-full rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Request a new challenge
          </button>
        </div>
      )}

      {step === 'error' && (
        <div className="space-y-4">
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {errorMessage}
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="w-full rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Try again
          </button>
        </div>
      )}

      {step === 'verified' && result && (
        <div role="status" className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="font-semibold text-emerald-800">Wallet ownership verified.</p>
          <dl className="space-y-2 text-sm text-emerald-700">
            <div className="flex justify-between gap-4">
              <dt className="font-medium text-emerald-900">Verified address</dt>
              <dd className="break-all font-mono text-xs">{result.walletAddress}</dd>
            </div>
            {result.verifiedAt && (
              <div className="flex justify-between gap-4">
                <dt className="font-medium text-emerald-900">Verified at</dt>
                <dd>{new Date(result.verifiedAt).toLocaleString()}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="font-medium text-emerald-900">Payments on hold</dt>
              <dd>{result.paymentsOnHold ? 'Yes' : 'No'}</dd>
            </div>
            {result.paymentsOnHold && result.holdReason && (
              <div className="flex justify-between gap-4">
                <dt className="font-medium text-emerald-900">Hold reason</dt>
                <dd>{result.holdReason}</dd>
              </div>
            )}
          </dl>
          {result.paymentsOnHold && (
            <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Pending payments are on safe hold. They will be released automatically once the new
              address is confirmed.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export default WalletOwnershipValidator;
