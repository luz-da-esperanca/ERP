import { describe, expect, it } from 'vitest';
import type { Capability, Role } from '@erp/contracts/access';
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
    expect(capabilitiesFor(['COORDINATION'])).toEqual([
      'attendance.read',
      'attendance.write',
      'audit.read',
      'eligibility.evaluate',
      'eligibility.policy.write',
      'eligibility.read',
      'featureDecisions.manage',
      'participants.lookup',
      'projects.read',
      'projects.write',
      'registration.merge',
      'registration.read',
      'registration.write',
      'reports.read',
      'socialForms.read',
      'socialForms.write',
    ]);
  });
  it('limits social assistance to registration, forms and scoped consultation', () => {
    expect(capabilitiesFor(['SOCIAL_ASSISTANCE'])).toEqual([
      'attendance.read',
      'audit.read',
      'eligibility.evaluate',
      'eligibility.read',
      'participants.lookup',
      'projects.read',
      'registration.merge',
      'registration.read',
      'registration.write',
      'reports.read',
      'socialForms.read',
      'socialForms.write',
    ]);
  });
  it('combines role capabilities without duplicates or implicit extra permissions', () => {
    expect(capabilitiesFor(['ADMINISTRATOR', 'SOCIAL_ASSISTANCE'])).toEqual([
      'accounts.manage',
      'attendance.read',
      'audit.read',
      'eligibility.evaluate',
      'eligibility.read',
      'participants.lookup',
      'projects.read',
      'registration.merge',
      'registration.read',
      'registration.write',
      'reports.read',
      'socialForms.read',
      'socialForms.write',
    ]);
  });
  it.each<{ role: Role; capability: Capability }>([
    { role: 'ADMINISTRATOR', capability: 'accounts.manage' },
    { role: 'ACTIVITY_MANAGER', capability: 'attendance.write' },
    { role: 'SOCIAL_ASSISTANCE', capability: 'socialForms.read' },
    { role: 'COORDINATION', capability: 'eligibility.policy.write' },
  ])(
    'allows $role to use $capability after the required password change',
    ({ role, capability }) => {
      expect(() => assertPermission([role], false, capability)).not.toThrow();
    },
  );

  it.each<{ role: Role; capability: Capability }>([
    { role: 'ADMINISTRATOR', capability: 'socialForms.read' },
    { role: 'ACTIVITY_MANAGER', capability: 'registration.write' },
    { role: 'SOCIAL_ASSISTANCE', capability: 'eligibility.policy.write' },
    { role: 'COORDINATION', capability: 'accounts.manage' },
  ])('denies $role access to $capability', ({ role, capability }) => {
    expect(() => assertPermission([role], false, capability)).toThrowError(
      expect.objectContaining({ status: 403, code: 'FORBIDDEN' }),
    );
  });

  it('permits an operation supplied by another assigned role', () => {
    expect(() =>
      assertPermission(
        ['ADMINISTRATOR', 'SOCIAL_ASSISTANCE'],
        false,
        'socialForms.read',
      ),
    ).not.toThrow();
  });

  it.each<Role>([
    'ADMINISTRATOR',
    'ACTIVITY_MANAGER',
    'SOCIAL_ASSISTANCE',
    'COORDINATION',
  ])(
    'blocks domain operations for %s until the required password change',
    (role) => {
      expect(() => assertPermission([role], true, 'audit.read')).toThrowError(
        expect.objectContaining({
          status: 403,
          code: 'FORBIDDEN',
          details: { rule: 'PASSWORD_CHANGE_REQUIRED' },
        }),
      );
    },
  );
});
