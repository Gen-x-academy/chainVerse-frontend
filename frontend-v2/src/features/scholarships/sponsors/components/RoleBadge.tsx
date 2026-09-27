'use client';

import React from 'react';
import {
  ShieldAlert,
  Coins,
  Layers,
  FileCheck,
  BarChart3,
} from 'lucide-react';
import {
  SPONSOR_ROLE_DEFINITIONS,
  type SponsorTeamRole,
} from '../types';

export interface RoleBadgeProps {
  role: SponsorTeamRole;
  showIcon?: boolean;
  className?: string;
}

const ROLE_STYLES: Record<
  SponsorTeamRole,
  { bg: string; text: string; border: string; icon: React.ElementType }
> = {
  owner: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    icon: ShieldAlert,
  },
  finance: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    icon: Coins,
  },
  program: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    icon: Layers,
  },
  reviewer: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    icon: FileCheck,
  },
  reporting: {
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
    icon: BarChart3,
  },
};

export function RoleBadge({ role, showIcon = true, className = '' }: RoleBadgeProps) {
  const roleDef = SPONSOR_ROLE_DEFINITIONS[role] ?? {
    title: role,
    leastPrivilegeScope: role,
  };
  const style = ROLE_STYLES[role] ?? {
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    border: 'border-gray-200',
    icon: ShieldAlert,
  };
  const Icon = style.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.text} ${style.border} ${className}`}
      title={`${roleDef.title}: ${roleDef.leastPrivilegeScope}`}
      aria-label={`Role: ${roleDef.title}. ${roleDef.leastPrivilegeScope}`}
    >
      {showIcon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      <span>{roleDef.title}</span>
    </span>
  );
}
