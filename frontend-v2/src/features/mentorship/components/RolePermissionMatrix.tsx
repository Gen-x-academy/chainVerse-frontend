'use client';

import { useMemo, useState } from 'react';
import {
  MENTORSHIP_ROLE_PERMISSIONS,
  MENTORSHIP_ROLES,
  describeMentorshipDenial,
  type MentorshipResource,
  type MentorshipRole,
} from '../rbac';

type Props = {
  /** UX guard — the API enforces the same grants (MENTOR-003). */
  canView?: boolean;
};

const RESOURCES: MentorshipResource[] = [
  'mentor-profile',
  'mentee-profile',
  'expertise-taxonomy',
  'verification',
  'program',
  'engagement',
  'session',
  'deliverable',
  'payment',
  'dispute',
  'configuration',
  'audit-event',
];

export function RolePermissionMatrix({ canView = true }: Props) {
  const [probeRole, setProbeRole] = useState<MentorshipRole>('mentor');

  const rows = useMemo(
    () =>
      MENTORSHIP_ROLES.map((role) => ({
        role,
        grants: MENTORSHIP_ROLE_PERMISSIONS[role],
      })),
    [],
  );

  if (!canView) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700" role="alert">
        {describeMentorshipDenial({ allowed: false, reason: 'NO_PERMISSION' })}
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-slate-600">
        Deny-by-default. Cross-tenant and self-approval attempts always fail, regardless of the
        grants shown below.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">
            Actions granted to each mentorship role, by resource.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="border-b border-slate-200 p-2 font-semibold text-slate-700">
                Resource
              </th>
              {rows.map((row) => (
                <th
                  key={row.role}
                  scope="col"
                  className="border-b border-slate-200 p-2 font-semibold text-slate-700"
                >
                  {row.role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RESOURCES.map((resource) => (
              <tr key={resource}>
                <th scope="row" className="border-b border-slate-100 p-2 font-medium text-slate-800">
                  {resource}
                </th>
                {rows.map((row) => {
                  const actions = row.grants[resource] ?? [];
                  return (
                    <td key={row.role} className="border-b border-slate-100 p-2 align-top text-slate-600">
                      {actions.length > 0 ? actions.join(', ') : <span aria-label="no access">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <label htmlFor="mentorship-probe-role" className="block text-sm font-medium text-slate-700">
          Preview the operations available to a role
        </label>
        <select
          id="mentorship-probe-role"
          value={probeRole}
          onChange={(event) => setProbeRole(event.target.value as MentorshipRole)}
          className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        >
          {MENTORSHIP_ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <p className="mt-2 text-sm text-slate-600">
          {probeRole} may act on{' '}
          {Object.keys(MENTORSHIP_ROLE_PERMISSIONS[probeRole]).length} resource type(s).
        </p>
      </div>
    </section>
  );
}
