import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"]
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"]
});

export const metadata: Metadata = {
  title: "ChainVerse - Authentication",
  description: "Login or Sign up to ChainVerse Academy"
};

export default function AuthLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-gray-50`}>
      <div className="flex min-h-screen flex-col items-center py-5 justify-center sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  );
} 