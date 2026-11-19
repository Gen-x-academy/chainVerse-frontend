'use client';

import { Header } from '@/src/components/common/Header';
import { Footer } from '@/src/components/common/Footer';
import { WorkspaceNav } from '@/src/components/workspace/WorkspaceNav';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Header />
      <WorkspaceNav />
      <main id="main-content" className="min-h-screen">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
      <Footer />
    </>
  );
}