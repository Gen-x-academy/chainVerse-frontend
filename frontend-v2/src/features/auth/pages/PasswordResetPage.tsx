'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthForm } from '../components/AuthForm';
import { apiClient } from '@/lib/api-client';

const emailSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email'),
});

const codeSchema = z.object({
  code: z.string().min(6, 'Code must be 6 digits').max(6, 'Code must be 6 digits'),
});

const resetSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d: { password: string; confirmPassword: string }) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type EmailFormData = z.infer<typeof emailSchema>;
type CodeFormData = z.infer<typeof codeSchema>;
type ResetFormData = z.infer<typeof resetSchema>;

export const PasswordResetPage: React.FC = () => {
  const [step, setStep] = useState<'request' | 'verify' | 'reset'>('request');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [verifiedCode, setVerifiedCode] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);

  const emailForm = useForm<EmailFormData>({ resolver: zodResolver(emailSchema) });
  const codeForm = useForm<CodeFormData>({ resolver: zodResolver(codeSchema) });
  const resetForm = useForm<ResetFormData>({ resolver: zodResolver(resetSchema) });

  const onRequestReset = async (data: EmailFormData) => {
    setApiError(null);
    try {
      await apiClient.post('/api/auth/password-reset/request', { email: data.email });
      setSubmittedEmail(data.email);
      setStep('verify');
    } catch {
      setApiError('Failed to send reset code. Please try again.');
    }
  };

  const onVerifyCode = async (data: CodeFormData) => {
    setApiError(null);
    try {
      await apiClient.post('/api/auth/password-reset/verify', {
        email: submittedEmail,
        code: data.code,
      });
      setVerifiedCode(data.code);
      setStep('reset');
    } catch {
      setApiError('Invalid or expired code. Please try again.');
    }
  };

  const router = useRouter();

  const onResetPassword = async (data: ResetFormData) => {
    setApiError(null);
    try {
      await apiClient.post('/api/auth/password-reset/confirm', {
        email: submittedEmail,
        code: verifiedCode,
        password: data.password,
      });
      router.push('/auth/login');
    } catch {
      setApiError('Failed to reset password. Please try again.');
    }
  };

  if (step === 'verify') {
    return (
      <AuthForm
        title="Check Your Email"
        subtitle={`We sent a 6-digit code to ${submittedEmail}`}
        onSubmit={codeForm.handleSubmit(onVerifyCode)}
      >
        {apiError && (
          <div role="alert" className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {apiError}
          </div>
        )}
        <div>
          <label htmlFor="code" className="block text-sm font-semibold text-gray-700 mb-2">
            Verification Code
          </label>
          <input
            id="code"
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
            <p className="text-red-500 text-sm mt-1">{codeForm.formState.errors.code.message}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={codeForm.formState.isSubmitting}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          {codeForm.formState.isSubmitting ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Verifying...</>
          ) : 'Verify Code'}
        </button>
        <p className="text-center text-gray-600 text-sm">
          Didn&apos;t receive a code?{' '}
          <button type="button" onClick={() => setStep('request')} className="text-blue-600 hover:text-blue-700 font-semibold">
            Try again
          </button>
        </p>
      </AuthForm>
    );
  }

  if (step === 'reset') {
    return (
      <AuthForm
        title="Set New Password"
        subtitle="Choose a strong password for your account"
        onSubmit={resetForm.handleSubmit(onResetPassword)}
      >
        {apiError && (
          <div role="alert" className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {apiError}
          </div>
        )}
        <div>
          <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
            New Password
          </label>
          <input
            id="password"
            type="password"
            placeholder="••••••••"
            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition ${
              resetForm.formState.errors.password
                ? 'border-red-300 focus-visible:ring-red-500'
                : 'border-gray-300 focus-visible:ring-blue-500'
            }`}
            {...resetForm.register('password')}
          />
          {resetForm.formState.errors.password && (
            <p className="text-red-500 text-sm mt-1">{resetForm.formState.errors.password.message}</p>
          )}
        </div>
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-2">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            placeholder="••••••••"
            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition ${
              resetForm.formState.errors.confirmPassword
                ? 'border-red-300 focus-visible:ring-red-500'
                : 'border-gray-300 focus-visible:ring-blue-500'
            }`}
            {...resetForm.register('confirmPassword')}
          />
          {resetForm.formState.errors.confirmPassword && (
            <p className="text-red-500 text-sm mt-1">{resetForm.formState.errors.confirmPassword.message}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={resetForm.formState.isSubmitting}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          {resetForm.formState.isSubmitting ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Resetting...</>
          ) : 'Reset Password'}
        </button>
      </AuthForm>
    );
  }

  return (
    <AuthForm
      title="Reset Password"
      subtitle="Enter your email and we'll send you a reset code"
      onSubmit={emailForm.handleSubmit(onRequestReset)}
    >
      {apiError && (
        <div role="alert" className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {apiError}
        </div>
      )}
      <div>
        <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
          Email Address
        </label>
        <input
          id="email"
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
          <p className="text-red-500 text-sm mt-1">{emailForm.formState.errors.email.message}</p>
        )}
      </div>
      <button
        type="submit"
        disabled={emailForm.formState.isSubmitting}
        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        {emailForm.formState.isSubmitting ? (
          <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Sending...</>
        ) : 'Send Reset Code'}
      </button>
      <p className="text-center text-gray-600 text-sm">
        Remember your password?{' '}
        <Link href="/auth/login" className="text-blue-600 hover:text-blue-700 font-semibold">Sign in</Link>
      </p>
    </AuthForm>
  );
};
