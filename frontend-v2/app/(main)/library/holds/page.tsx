'use client';

import { SectionContainer } from '@/shared/components/layout/SectionContainer';

export default function LibraryHoldsPage() {
  return (
    <SectionContainer className="py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">My Holds</h1>
      <div className="rounded-lg border border-dashed p-8 text-center" role="status">
        <p className="text-sm text-muted-foreground">No holds — your hold queue is empty.</p>
      </div>
    </SectionContainer>
  );
}
