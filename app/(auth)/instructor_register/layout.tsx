import type React from 'react';
import { Header } from '@/components/header';
import { FormProvider } from '@/lib/form-context';
import Footer from '@/components/Footer';

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="min-h-screen flex flex-col  bg-[#FCFAF8] ">
        {/* <Header /> */}
        <FormProvider>
          <main className="flex-1">
            <div className="container mx-auto px-4 py-8">{children}</div>
            <div className="container mx-auto px-4"></div>
          </main>
        </FormProvider>
        {/* <Footer /> */}
      </div>
    </>
  );
}
