/** MENTOR-020: configure how a mentorship program is delivered. */
export type DeliveryMode = 'virtual' | 'in_person' | 'hybrid' | 'async';

export interface DeliveryConfig {
  mode: DeliveryMode;
  /** IANA time zone used to display session times. */
  timeZone: string;
  location?: string;
  videoProvider?: 'in_app' | 'external';
  meetingUrl?: string;
  /** Minimum notice, in hours, to reschedule a session. */
  rescheduleNoticeHours: number;
}

export const DELIVERY_MODE_LABELS: Record<DeliveryMode, string> = {
  virtual: 'Virtual',
  in_person: 'In person',
  hybrid: 'Hybrid',
  async: 'Asynchronous',
};

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function validateDeliveryConfig(c: DeliveryConfig): string[] {
  const errors: string[] = [];
  if (!isValidTimeZone(c.timeZone)) errors.push('Choose a valid time zone');
  if ((c.mode === 'in_person' || c.mode === 'hybrid') && !c.location?.trim()) errors.push('A location is required for in-person and hybrid programs');
  if ((c.mode === 'virtual' || c.mode === 'hybrid') && c.videoProvider === 'external') {
    if (!c.meetingUrl || !/^https:\/\//i.test(c.meetingUrl)) errors.push('External video needs an https meeting URL');
  }
  if (c.rescheduleNoticeHours < 0 || c.rescheduleNoticeHours > 168) errors.push('Reschedule notice must be 0-168 hours');
  return errors;
}

/** Fields that do not apply to the chosen mode are dropped so stale values never persist. */
export function normalizeDeliveryConfig(c: DeliveryConfig): DeliveryConfig {
  const physical = c.mode === 'in_person' || c.mode === 'hybrid';
  const video = c.mode === 'virtual' || c.mode === 'hybrid';
  return {
    ...c,
    location: physical ? c.location?.trim() : undefined,
    videoProvider: video ? c.videoProvider ?? 'in_app' : undefined,
    meetingUrl: video && c.videoProvider === 'external' ? c.meetingUrl : undefined,
  };
}
