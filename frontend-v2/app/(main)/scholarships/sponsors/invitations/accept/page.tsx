'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/src/store/authStore';
import { AcceptInvitationView } from '@/src/features/scholarships/sponsors';

function AcceptInvitationContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const user = useAuthStore((state) => state.user);

  const currentUser = user
    ? {
        id: user.id,
        email: user.email,
        name: user.name || user.email.split('@')[0],
      }
    : {
        id: 'anon-invitee',
        email: 'colleague@partner.org',
        name: 'Team Invitee',
      };

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <AcceptInvitationView token={token} currentUser={currentUser} />
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center p-6 text-center" role="status">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <span className="sr-only">Loading invitation...</span>
        </div>
      }
    >
      <AcceptInvitationContent />
    </Suspense>
  );
}
