type Props = {
  recipientWalletAddress: string;
  assetCode: string;
  issuer?: string;
};

export function TrustlineGuidanceAlert({ recipientWalletAddress, assetCode, issuer }: Props) {
  return (
    <div
      role="alert"
      aria-label="Missing trustline guidance"
      className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"
    >
      <p className="font-semibold text-amber-900">
        Missing trustline for <span className="font-mono">{assetCode}</span>
      </p>
      <p className="text-amber-800">
        The recipient wallet{' '}
        <span
          className="break-all font-mono text-xs"
          aria-label={`Recipient wallet ${recipientWalletAddress}`}
        >
          {recipientWalletAddress}
        </span>{' '}
        has not established a trustline for <span className="font-mono font-semibold">{assetCode}</span>.
        Payments cannot be delivered until the recipient adds this asset to their wallet.
      </p>
      {issuer && (
        <p className="text-xs text-amber-700">
          Issuer: <span className="break-all font-mono">{issuer}</span>
        </p>
      )}
      <p className="text-xs text-amber-600">
        The recipient should open their Stellar wallet, find <strong>Add asset</strong>, search for{' '}
        <span className="font-mono">{assetCode}</span>, and approve the trustline. Award eligibility
        is preserved while the trustline is being established.
      </p>
    </div>
  );
}

export default TrustlineGuidanceAlert;
