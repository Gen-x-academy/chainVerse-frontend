import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cn } from "@/lib"; // Leveraging the new lib/index.ts (#109)
import Providers from "@/src/shared/utils/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ChainVerse — Blockchain Learning Platform",
  description: "Learn blockchain, DeFi, NFTs and smart contracts on ChainVerse.",
  icons: { icon: "/icon.png" },
  openGraph: {
    title: "ChainVerse — Blockchain Learning Platform",
    description: "Learn blockchain, DeFi, NFTs and smart contracts on ChainVerse.",
    url: "https://chainverse.app",
    siteName: "ChainVerse",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "ChainVerse" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ChainVerse — Blockchain Learning Platform",
    description: "Learn blockchain, DeFi, NFTs and smart contracts on ChainVerse.",
    images: ["/og-image.png"],
  },
};

/**
 * Probes the backend `/health` endpoint at app start.
 *
 * Strips the trailing `/api` or `/api/vN` segment from
 * `NEXT_PUBLIC_API_BASE_URL` so the probe hits the backend root
 * (e.g. `http://localhost:3001/health` rather than
 * `http://localhost:3001/api/v1/health`). The result is cached for
 * 30 seconds via Next's fetch revalidation so the layout doesn't
 * hammer the API on every navigation.
 *
 * Returns `false` for any failure — missing config, network error,
 * timeout, or non-2xx — so the banner only ever appears when
 * something is genuinely wrong.
 */
async function isBackendHealthy(): Promise<boolean> {
  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiUrl) return false;

  const baseUrl = apiUrl.replace(/\/api(\/.*)?$/, "");
  try {
    const res = await fetch(`${baseUrl}/health`, {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const healthy = await isBackendHealthy();

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          geistSans.variable,
          geistMono.variable,
          "min-h-screen bg-background font-sans antialiased"
        )}
      >
        {!healthy && (
          <div
            role="status"
            aria-live="polite"
            data-testid="maintenance-banner"
            className="bg-yellow-100 text-yellow-800 text-sm text-center py-2 border-b border-yellow-200"
          >
            Backend is starting up. Some features may be temporarily
            unavailable.
          </div>
        )}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}