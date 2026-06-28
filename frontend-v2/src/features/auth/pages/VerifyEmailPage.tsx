'use client';

import React from 'react';
import Link from 'next/link';
import { AuthForm } from '../components/AuthForm';

export const VerifyEmailPage: React.FC = () => {
  return (
    <AuthForm
      title="Verify Your Email"
      subtitle="We sent a verification link to your email address. Please check your inbox."
      onSubmit={() => {}}
    >
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-gray-600 text-sm text-center">
          Didn&apos;t receive the email? Check your spam folder or{' '}
          <Link href="/auth/login" className="text-blue-600 hover:text-blue-700 font-semibold">
            try again
          </Link>
        </p>
        <Link
          href="/auth/login"
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-4 rounded-lg transition text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          Back to Login
        </Link>
      </div>
    </AuthForm>
  );
};
