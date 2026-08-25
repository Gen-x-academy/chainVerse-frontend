interface LicenseRestrictionBannerProps {
  status: "available" | "expiring" | "expired" | "territory_restricted";
  expiresAt?: string;
  territory?: string;
  alternativeFormatUrl?: string;
}

function formatExpiry(expiresAt: string) {
  return new Date(expiresAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function LicenseRestrictionBanner({
  status,
  expiresAt,
  territory,
  alternativeFormatUrl,
}: LicenseRestrictionBannerProps) {
  if (status === "available") return null;

  const messages: Record<string, string> = {
    expiring: expiresAt ? `License expires on ${formatExpiry(expiresAt)}.` : "License is expiring soon.",
    expired: expiresAt ? `License expired on ${formatExpiry(expiresAt)}.` : "This license has expired.",
    territory_restricted: territory
      ? `Not available in your region (${territory}).`
      : "Not available in your region.",
  };

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
      <p>{messages[status]}</p>
      {alternativeFormatUrl && (
        <a href={alternativeFormatUrl} className="mt-1 inline-block underline">
          View an available alternative format
        </a>
      )}
    </div>
  );
}
