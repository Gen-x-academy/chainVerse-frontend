'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AuthForm } from '../components/AuthForm';

const emailSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email'),
});

const codeSchema = z.object({
  code: z
    .string()
    .min(6, 'Verification code must be 6 digits')
    .max(6, 'Verification code must be 6 digits'),
});

type EmailFormData = z.infer<typeof emailSchema>;
type CodeFormData = z.infer<typeof codeSchema>;

export const PasswordResetPage: React.FC = () => {
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [submittedEmail, setSubmittedEmail] = useState('');

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
  });

  const codeForm = useForm<CodeFormData>({
    resolver: zodResolver(codeSchema),
  });

  const onRequestReset = (data: EmailFormData) => {
    console.log('Password reset requested for:', data.email);
    setSubmittedEmail(data.email);
    setStep('verify');
  };

  const onVerifyCode = (data: CodeFormData) => {
    console.log('Verification code submitted:', data.code);
  };

  if (step === 'verify') {
    return (
      <AuthForm
        title="Check Your Email"
        subtitle={`We sent a 6-digit code to ${submittedEmail}`}
        onSubmit={codeForm.handleSubmit(onVerifyCode)}
      >
        {/* Code Input */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Verification Code
          </label>
          <input
            type="text"
            placeholder="123456"
            maxLength={6}
            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition tracking-widest text-center text-lg ${
              codeForm.formState.errors.code
                ? 'border-red-300 focus-visible:ring-red-500'
                : 'border-gray-300 focus-visible:ring-blue-500'
            }`}
            {...codeForm.register('code')}
          />
          {codeForm.formState.errors.code && (
            <p className="text-red-500 text-sm mt-1">
              {codeForm.formState.errors.code.message}
            </p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={codeForm.formState.isSubmitting}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          {codeForm.formState.isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Verifying...
            </>
          ) : (
            'Verify Code'
          )}
        </button>

        {/* Back */}
        <p className="text-center text-gray-600 text-sm">
          Didn&apos;t receive a code?{' '}
          <button
            type="button"
            onClick={() => setStep('request')}
            className="text-blue-600 hover:text-blue-700 font-semibold"
          >
            Try again
          </button>
        </p>
      </AuthForm>
    );
  }

  return (
    <AuthForm
      title="Reset Password"
      subtitle="Enter your email and we'll send you a reset code"
      onSubmit={emailForm.handleSubmit(onRequestReset)}
    >
      {/* Email */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Email Address
        </label>
        <input
          type="email"
          placeholder="you@example.com"
          className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition ${
            emailForm.formState.errors.email
              ? 'border-red-300 focus-visible:ring-red-500'
              : 'border-gray-300 focus-visible:ring-blue-500'
          }`}
          {...emailForm.register('email')}
        />
        {emailForm.formState.errors.email && (
          <p className="text-red-500 text-sm mt-1">
            {emailForm.formState.errors.email.message}
          </p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={emailForm.formState.isSubmitting}
        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        {emailForm.formState.isSubmitting ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Sending...
          </>
        ) : (
          'Send Reset Code'
        )}
      </button>

      {/* Back to login */}
      <p className="text-center text-gray-600 text-sm">
        Remember your password?{' '}
        <a href="/auth/login" className="text-blue-600 hover:text-blue-700 font-semibold">
          Sign in
        </a>
      </p>
    </AuthForm>
  );
};
