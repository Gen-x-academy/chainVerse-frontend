'use client';

import React from 'react';
import { AlertTriangle, Ban, Clock } from 'lucide-react';

export type AccountStatus = 'active' | 'blocked' | 'suspended';

interface AccountStatusBannerProps {
  status: AccountStatus;
  reason?: string;
  expiresAt?: string;
}

const STATUS_CONFIG: Record<AccountStatus, {
  icon: React.ElementType;
  bgColor: string;
  borderColor: string;
  title: string;
  defaultReason: string;
}> = {
  active: {
    icon: Clock,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    title: '',
    defaultReason: '',
  },
  blocked: {
    icon: Ban,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    title: 'Account Blocked',
    defaultReason: 'This account has been blocked due to a policy violation. Contact library staff to resolve.',
  },
  suspended: {
    icon: AlertTriangle,
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    title: 'Account Suspended',
    defaultReason: 'This account is temporarily suspended. You may not be able to borrow or place holds until the suspension is lifted.',
  },
};

export function AccountStatusBanner({ status, reason, expiresAt }: AccountStatusBannerProps) {
  if (status === 'active') return null;

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div
      role="alert"
      className={`${config.bgColor} border ${config.borderColor} rounded-lg p-4 mb-6`}
    >
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 text-current flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-gray-900">{config.title}</h3>
          <p className="text-sm text-gray-700 mt-1">{reason ?? config.defaultReason}</p>
          {expiresAt && (
            <p className="text-sm text-gray-500 mt-1">
              Expires: {new Date(expiresAt).toLocaleDateString()}
            </p>
          )}
          <p className="text-sm text-gray-500 mt-2">
            If you believe this is an error, please{' '}
            <a href="/contact" className="text-indigo-600 hover:underline">
              contact library support
            </a>.
          </p>
        </div>
      </div>
    </div>
  );
}
