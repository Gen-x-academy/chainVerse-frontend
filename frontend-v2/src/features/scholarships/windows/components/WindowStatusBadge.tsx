'use client';

import React from 'react';
import { AlertTriangle, Clock, Hourglass, Lock, ShieldCheck } from 'lucide-react';
import { determineWindowStatus } from '../domain';
import type { ApplicationWindow, WindowStatus } from '../types';

interface WindowStatusBadgeProps {
  window: ApplicationWindow;
  now?: Date;
  className?: string;
}

export function WindowStatusBadge({ window, now = new Date(), className = '' }: WindowStatusBadgeProps) {
  const status: WindowStatus = determineWindowStatus(window, now);

  const getBadgeConfig = () => {
    switch (status) {
      case 'UPCOMING':
        return {
          icon: Clock,
          label: 'Upcoming',
          subtext: `Opens ${new Date(window.openInstantUtc).toLocaleDateString()}`,
          classes: 'border-blue-200 bg-blue-50 text-blue-800',
        };
      case 'OPEN':
        return {
          icon: ShieldCheck,
          label: 'Open for Applications',
          subtext: `Closes ${new Date(window.closeInstantUtc).toLocaleDateString()}`,
          classes: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        };
      case 'GRACE_PERIOD':
        return {
          icon: Hourglass,
          label: 'Grace Period Active',
          subtext: `${window.gracePeriodMinutes}m grace for in-flight traffic`,
          classes: 'border-amber-200 bg-amber-50 text-amber-900 animate-pulse',
        };
      case 'LATE_WINDOW':
        return {
          icon: AlertTriangle,
          label: 'Late Submissions Open',
          subtext: `Policy: ${window.lateSubmissionPolicy.replace('_', ' ')}`,
          classes: 'border-purple-200 bg-purple-50 text-purple-800',
        };
      case 'CLOSED':
      default:
        return {
          icon: Lock,
          label: 'Closed',
          subtext: `Deadline passed on ${new Date(window.closeInstantUtc).toLocaleDateString()}`,
          classes: 'border-slate-200 bg-slate-100 text-slate-700',
        };
    }
  };

  const config = getBadgeConfig();
  const Icon = config.icon;

  return (
    <div
      aria-label={`Window status: ${config.label}, ${config.subtext}, Timezone: ${window.timeZone}`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${config.classes} ${className}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{config.label}</span>
    </div>
  );
}
