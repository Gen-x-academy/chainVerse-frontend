/** Organization mentorship programs for issue MENTOR-015. */

export type MentorshipProgramStatus = 'draft' | 'published';

export type ProgramVisibility = 'public' | 'restricted';

export type ProgramDeliveryMode = 'async' | 'live' | 'hybrid';

export interface MentorshipProgram {
  /** Relational key used by the API; never exposed in public endpoints. */
  internalId: string;
  /** Stable, collision-resistant identifier that is safe to expose. */
  publicId: string;
  /** Correlation identifier used to group retries and event logs. */
  correlationId: string;
  organizationId: string;
  name: string;
  audience: string[];
  outcomes: string[];
  capacity: number;
  durationWeeks: number;
  deliveryMode: ProgramDeliveryMode;
  startsAt: string;
  endsAt?: string;
  ownerUserId: string;
  visibility: ProgramVisibility;
  status: MentorshipProgramStatus;
}

export interface CreateProgramPayload {
  organizationId: string;
  name: string;
  audience: string[];
  outcomes: string[];
  capacity: number;
  durationWeeks: number;
  deliveryMode: ProgramDeliveryMode;
  startsAt: string;
  endsAt?: string;
  ownerUserId: string;
  visibility: ProgramVisibility;
}
