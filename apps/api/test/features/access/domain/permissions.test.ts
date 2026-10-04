import { describe, expect, it } from 'vitest';
import {
  capabilitiesFor,
  assertPermission,
} from '../../../../src/features/access/domain/permissions.js';
describe('Access policies', () => {
  it('keeps account administration separate from social data', () => {
    expect(capabilitiesFor(['ADMINISTRATOR'])).toEqual([
      'accounts.manage',
      'audit.read',
    ]);
  });
  it('limits activity managers to lookup, activities, attendance and scoped reports', () => {
    expect(capabilitiesFor(['ACTIVITY_MANAGER'])).toEqual([
      'attendance.read',
      'attendance.write',
      'audit.read',
      'participants.lookup',
      'projects.read',
      'reports.read',
    ]);
  });
  it('reserves policy publication and institutional decisions to coordination', () => {
    expect(capabilitiesFor(['COORDINATION'])).toContain(
      'eligibility.policy.write',
    );
    expect(capabilitiesFor(['COORDINATION'])).toContain(
      'featureDecisions.manage',
    );
    expect(capabilitiesFor(['SOCIAL_ASSISTANCE'])).not.toContain(
      'eligibility.policy.write',
    );
    expect(capabilitiesFor(['SOCIAL_ASSISTANCE'])).not.toContain(
      'accounts.manage',
    );
  });
  it('combines role capabilities without duplicates or implicit extra permissions', () => {
    expect(capabilitiesFor(['ADMINISTRATOR', 'SOCIAL_ASSISTANCE'])).toEqual(
      [
        ...new Set([
          ...capabilitiesFor(['ADMINISTRATOR']),
          ...capabilitiesFor(['SOCIAL_ASSISTANCE']),
        ]),
      ].sort(),
    );
  });
  it('blocks domain operations until the required password change', () => {
    expect(() =>
      assertPermission(['ADMINISTRATOR'], true, 'accounts.manage'),
    ).toThrow('Operation not permitted');
  });
});
