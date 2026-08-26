'use client';

import React from 'react';

interface AuthFormProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  noValidate?: boolean;
}

export const AuthForm: React.FC<AuthFormProps> = ({ title, subtitle, children, onSubmit, noValidate }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden p-6 sm:p-8">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-12">
            <h1 className="text-3xl font-bold text-white mb-2">{title}</h1>
            <p className="text-blue-100">{subtitle}</p>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} noValidate={noValidate} className="p-8 space-y-5">
            {children}
          </form>
        </div>
      </div>
    </div>
  );
};
