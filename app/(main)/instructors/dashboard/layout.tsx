import DashboardShell from '@/components/instructors/dashboard/DashboardShell';
import { Geist, Geist_Mono } from 'next/font/google';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata = {
  title: 'ChainVerse | Instructor Dashboard',
  description: 'Learn Blockchain. Earn Crypto',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${geistSans.variable} ${geistMono.variable} antialiased `}>
      <DashboardShell>{children}</DashboardShell>
    </div>
  );
}
