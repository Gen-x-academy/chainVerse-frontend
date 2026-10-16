import { describe, expect, it } from 'vitest';
import {
  accessibleIdentityAreas,
  canAccessIdentityArea,
  toIdentityRole,
} from '../access';

describe('identity area access', () => {
  it('maps legacy platform roles onto the mentorship vocabulary', () => {
    expect(toIdentityRole('admin')).toBe('administrator');
    expect(toIdentityRole('instructor')).toBe('mentor');
    expect(toIdentityRole('student')).toBe('student');
    expect(toIdentityRole('unknown')).toBe('unknown');
    expect(toIdentityRole(undefined)).toBeUndefined();
  });

  it('grants each identity surface to its intended roles', () => {
    expect(canAccessIdentityArea('mentor', 'mentor-profile')).toBe(true);
    expect(canAccessIdentityArea('mentor', 'verification')).toBe(true);
    expect(canAccessIdentityArea('admin', 'mentor-profile')).toBe(true);
    expect(canAccessIdentityArea('instructor', 'taxonomy')).toBe(true);
    expect(canAccessIdentityArea('student', 'learning-profile')).toBe(true);
  });

  it('denies a role outside the surface', () => {
    expect(canAccessIdentityArea('student', 'verification')).toBe(false);
    expect(canAccessIdentityArea('student', 'taxonomy')).toBe(false);
    expect(canAccessIdentityArea(undefined, 'mentor-profile')).toBe(false);
  });

  it('lists the surfaces a role can reach', () => {
    expect(accessibleIdentityAreas('mentor')).toEqual([
      'mentor-profile',
      'taxonomy',
      'verification',
    ]);
    expect(accessibleIdentityAreas(undefined)).toEqual([]);
  });
});
