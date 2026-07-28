/**
 * One-time-code OAuth exchange for issue #825.
 * The callback currently reads reusable access/refresh tokens from the URL,
 * which can leak via history, referrers, and logs. This exchanges a
 * short-lived code for tokens via a POST request instead, so the URL never
 * carries a reusable credential.
 */

type ExchangeResult = { accessToken: string; refreshToken: string };

export async function exchangeOAuthCode(code: string): Promise<ExchangeResult> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
  const response = await fetch(`${base}/auth/oauth/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    throw new Error('OAuth code exchange failed');
  }

  return response.json() as Promise<ExchangeResult>;
}

/** Strips the one-time code from the URL immediately after reading it. */
export function consumeOAuthCode(search: string): string | null {
  const params = new URLSearchParams(search);
  const code = params.get('code');
  if (code && typeof window !== 'undefined') {
    window.history.replaceState({}, '', window.location.pathname);
  }
  return code;
}
