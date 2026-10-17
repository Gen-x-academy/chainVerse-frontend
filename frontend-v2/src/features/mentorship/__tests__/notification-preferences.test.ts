import { describe, expect, it } from 'vitest';
import {
  MANDATORY_CATEGORIES,
  MANDATORY_DISCLOSURE,
  decideDelivery,
  defaultNotificationPreferences,
  isMandatoryCategory,
  isOptInCategory,
  optInToCategory,
  setCategoryChannel,
  withinQuietHours,
} from '../communication/notification-preferences';

describe('MENTOR-102 notification preferences', () => {
  it('enables transactional channels and leaves marketing off by default', () => {
    const prefs = defaultNotificationPreferences('user-1');
    for (const category of MANDATORY_CATEGORIES) {
      expect(prefs.categories[category].length).toBeGreaterThan(0);
      expect(isMandatoryCategory(category)).toBe(true);
    }
    expect(prefs.categories.marketing).toEqual([]);
    expect(isOptInCategory('marketing')).toBe(true);
    expect(MANDATORY_DISCLOSURE).toMatch(/never marketing/i);
  });

  it('denies disabling mandatory categories and refuses implicit marketing opt-in', () => {
    const prefs = defaultNotificationPreferences('user-1');
    expect(() => setCategoryChannel(prefs, 'payment', 'email', false)).toThrow(/mandatory/i);
    expect(() => setCategoryChannel(prefs, 'safety', 'sms', false)).toThrow(/mandatory/i);
    expect(() => setCategoryChannel(prefs, 'marketing', 'email', true)).toThrow(/explicit opt-in/i);
  });

  it('toggles optional channels idempotently and bumps the version only on change', () => {
    const prefs = defaultNotificationPreferences('user-1');
    const off = setCategoryChannel(prefs, 'session', 'sms', false);
    expect(off.categories.session).not.toContain('sms');
    expect(off.version).toBe(prefs.version + 1);
    expect(setCategoryChannel(off, 'session', 'sms', false)).toBe(off);
    const on = setCategoryChannel(off, 'session', 'sms', true);
    expect(on.categories.session).toContain('sms');
  });

  it('evaluates quiet hours in the supplied time zone and lets safety bypass them', () => {
    const prefs = {
      ...defaultNotificationPreferences('user-1'),
      quietHours: { startHour: 22, endHour: 7, timeZone: 'America/New_York' },
    };
    const quiet = new Date('2026-10-17T03:00:00.000Z'); // 23:00 in New York
    expect(withinQuietHours(prefs, quiet)).toBe(true);
    expect(decideDelivery(prefs, 'session', 'email', quiet)).toMatchObject({ send: false, reason: 'quiet_hours' });
    expect(decideDelivery(prefs, 'safety', 'email', quiet)).toMatchObject({
      send: true,
      reason: 'mandatory_bypasses_quiet_hours',
    });
    const daytime = new Date('2026-10-17T15:00:00.000Z'); // 11:00 in New York
    expect(withinQuietHours(prefs, daytime)).toBe(false);
  });

  it('honours explicit marketing opt-in per channel', () => {
    const prefs = optInToCategory(defaultNotificationPreferences('user-1'), 'marketing', ['email']);
    expect(prefs.categories.marketing).toEqual(['email']);
    expect(decideDelivery(prefs, 'marketing', 'email')).toMatchObject({ send: true, transactional: false });
    expect(decideDelivery(prefs, 'marketing', 'sms')).toMatchObject({ send: false, reason: 'channel_disabled' });
  });
});
