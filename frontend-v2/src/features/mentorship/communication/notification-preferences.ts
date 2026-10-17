/**
 * MENTOR-102: mentorship notification preferences.
 *
 * Users choose the permitted channels per notification category. Transactional
 * categories (payments and safety) are mandatory and cannot be disabled, and
 * their notices are always labelled as transactional so they can never be
 * mistaken for marketing. Marketing is denied by default and requires an
 * explicit opt-in. Quiet hours are evaluated in the user's own time zone.
 */

export const NOTIFICATION_CHANNELS = ['in_app', 'email', 'sms', 'push'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_CATEGORIES = [
  'application',
  'proposal',
  'session',
  'task',
  'payment',
  'safety',
  'marketing',
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/** Categories that carry transactional or legally required notices. */
export const MANDATORY_CATEGORIES: readonly NotificationCategory[] = ['payment', 'safety'];

/** Categories that must be explicitly opted into. */
export const OPT_IN_CATEGORIES: readonly NotificationCategory[] = ['marketing'];

export interface QuietHours {
  /** Local hour (0–23) when quiet hours begin, inclusive. */
  startHour: number;
  /** Local hour (0–23) when quiet hours end, exclusive. */
  endHour: number;
  /** IANA time zone the hours are expressed in. */
  timeZone: string;
}

export interface NotificationPreferences {
  userId: string;
  version: number;
  categories: Record<NotificationCategory, NotificationChannel[]>;
  quietHours?: QuietHours;
  updatedAt: string;
}

export const MANDATORY_DISCLOSURE =
  'Payment and safety notices are transactional and cannot be turned off; they are never marketing.';

export function isMandatoryCategory(category: NotificationCategory): boolean {
  return MANDATORY_CATEGORIES.includes(category);
}

export function isOptInCategory(category: NotificationCategory): boolean {
  return OPT_IN_CATEGORIES.includes(category);
}

export function defaultNotificationPreferences(userId: string, now: Date = new Date()): NotificationPreferences {
  const categories = {} as Record<NotificationCategory, NotificationChannel[]>;
  for (const category of NOTIFICATION_CATEGORIES) {
    categories[category] = isOptInCategory(category) ? [] : [...NOTIFICATION_CHANNELS];
  }
  return { userId, version: 1, categories, updatedAt: now.toISOString() };
}

function localHour(timeZone: string, at: Date): number {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(at);
  const hour = Number.parseInt(formatted, 10);
  return Number.isNaN(hour) ? 0 : hour % 24;
}

/** True when `at` falls inside the configured quiet hours in its own zone. */
export function withinQuietHours(prefs: NotificationPreferences, at: Date = new Date()): boolean {
  const quiet = prefs.quietHours;
  if (!quiet) return false;
  const { startHour, endHour } = quiet;
  if (startHour === endHour) return false;
  const hour = localHour(quiet.timeZone, at);
  return startHour < endHour ? hour >= startHour && hour < endHour : hour >= startHour || hour < endHour;
}

/**
 * Applies a channel toggle. Idempotent and deny-by-default: mandatory
 * categories reject disabling, opt-in categories reject the default-on path.
 */
export function setCategoryChannel(
  prefs: NotificationPreferences,
  category: NotificationCategory,
  channel: NotificationChannel,
  enabled: boolean,
  now: Date = new Date(),
): NotificationPreferences {
  const current = prefs.categories[category] ?? [];
  if (!enabled && isMandatoryCategory(category)) {
    throw new Error(`${category} notifications are mandatory and cannot be disabled`);
  }
  if (enabled && isOptInCategory(category)) {
    // Marketing must be enabled through an explicit opt-in call site.
    throw new Error(`${category} notifications require an explicit opt-in`);
  }
  const next = enabled
    ? Array.from(new Set([...current, channel]))
    : current.filter((c) => c !== channel);
  if (next.length === current.length && next.every((c, i) => c === current[i])) return prefs;
  return {
    ...prefs,
    version: prefs.version + 1,
    categories: { ...prefs.categories, [category]: next },
    updatedAt: now.toISOString(),
  };
}

/** Opts a user into a previously disabled, explicit-opt-in category. */
export function optInToCategory(
  prefs: NotificationPreferences,
  category: NotificationCategory,
  channels: NotificationChannel[],
  now: Date = new Date(),
): NotificationPreferences {
  if (!isOptInCategory(category)) {
    throw new Error(`${category} notifications do not require an explicit opt-in`);
  }
  if (channels.length === 0) throw new Error('At least one channel is required to opt in');
  return {
    ...prefs,
    version: prefs.version + 1,
    categories: { ...prefs.categories, [category]: Array.from(new Set(channels)) },
    updatedAt: now.toISOString(),
  };
}

export type DeliveryDecision =
  | { send: true; transactional: boolean; reason: 'enabled' | 'mandatory_bypasses_quiet_hours' }
  | { send: false; transactional: boolean; reason: 'channel_disabled' | 'quiet_hours' };

/**
 * Resolves whether a notice should be delivered now. Safety notices always
 * bypass quiet hours; all other categories respect them.
 */
export function decideDelivery(
  prefs: NotificationPreferences,
  category: NotificationCategory,
  channel: NotificationChannel,
  at: Date = new Date(),
): DeliveryDecision {
  const transactional = isMandatoryCategory(category);
  const channels = prefs.categories[category] ?? [];
  if (!channels.includes(channel)) return { send: false, transactional, reason: 'channel_disabled' };
  if (category === 'safety') return { send: true, transactional, reason: 'mandatory_bypasses_quiet_hours' };
  if (withinQuietHours(prefs, at)) return { send: false, transactional, reason: 'quiet_hours' };
  return { send: true, transactional, reason: 'enabled' };
}
