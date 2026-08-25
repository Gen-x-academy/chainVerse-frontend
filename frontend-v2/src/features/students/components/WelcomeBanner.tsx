'use client';

import React from 'react';

interface WelcomeBannerProps {
  firstName: string;
}

export function WelcomeBanner({ firstName }: WelcomeBannerProps) {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl p-8 mb-8">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2">Welcome back, {firstName}!</h1>
      <p className="text-blue-100">
        You&apos;re making great progress! Keep up the momentum and complete your courses.
      </p>
    </div>
  );
}
