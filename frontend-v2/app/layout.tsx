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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          geistSans.variable,
          geistMono.variable,
          "min-h-screen bg-background font-sans antialiased"
        )}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}