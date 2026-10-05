import { describe, expect, it } from 'vitest';
import type { Role } from '@erp/contracts/access';
import {
  AccountRevisionConflictError,
  AccountRuleError,
} from '../../../../src/features/access/domain/account-errors.js';
import {
  assertAdministratorRemains,
  assertRevision,
  planAccountProfileChange,
  planAccountActivation,
} from '../../../../src/features/access/domain/account-rules.js';
import type { Account } from '../../../../src/features/access/domain/account.js';

const current: Account = {
  id: '00000000-0000-4000-8000-000000000001',
  login: 'test.operator',
  displayName: 'Synthetic Operator',
  active: true,
  mustChangePassword: false,
  revision: 3,
  roleCodes: ['ADMINISTRATOR', 'SOCIAL_ASSISTANCE'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('Account transition plans', () => {
  it('treats reordered role sets as an unchanged profile without mutating inputs', () => {
    const roles: Role[] = ['SOCIAL_ASSISTANCE', 'ADMINISTRATOR'];
    expect(planAccountProfileChange(current, { roleCodes: roles }, 1)).toEqual({
      displayName: current.displayName,
      roleCodes: current.roleCodes,
      changed: false,
    });
    expect(roles).toEqual(['SOCIAL_ASSISTANCE', 'ADMINISTRATOR']);
  });

  it('allows renaming the last administrator while preserving its role', () => {
    expect(
      planAccountProfileChange(current, { displayName: 'Updated Operator' }, 1),
    ).toEqual({
      displayName: 'Updated Operator',
      roleCodes: current.roleCodes,
      changed: true,
    });
  });

  it('distinguishes an activation no-op from a deactivation that requires persistence', () => {
    expect(planAccountActivation(current, true, 1)).toEqual({
      active: true,
      changed: false,
    });
    expect(planAccountActivation(current, false, 2)).toEqual({
      active: false,
      changed: true,
    });
    expect(() => planAccountActivation(current, false, 1)).toThrowError(
      expect.objectContaining({ rule: 'LAST_ACTIVE_ADMINISTRATOR' }),
    );
  });
});

interface AdministratorTransition {
  name: string;
  currentActive: boolean;
  currentRoles: Role[];
  nextActive: boolean;
  nextRoles: Role[];
  activeAdministratorCount: number;
}

describe('Account revision invariant', () => {
  it.each([1, 3])('accepts a command matching revision %s', (revision) => {
    expect(() => assertRevision(revision, revision)).not.toThrow();
  });

  it.each([2, 4])(
    'rejects expected revision %s and exposes the current revision',
    (expected) => {
      expect(() => assertRevision(3, expected)).toThrowError(
        expect.objectContaining({
          name: AccountRevisionConflictError.name,
          currentRevision: 3,
        }),
      );
    },
  );
});

describe('Last active administrator invariant', () => {
  it.each<AdministratorTransition>([
    {
      name: 'deactivation',
      currentActive: true,
      currentRoles: ['ADMINISTRATOR'],
      nextActive: false,
      nextRoles: ['ADMINISTRATOR'],
      activeAdministratorCount: 1,
    },
    {
      name: 'role removal',
      currentActive: true,
      currentRoles: ['ADMINISTRATOR', 'SOCIAL_ASSISTANCE'],
      nextActive: true,
      nextRoles: ['SOCIAL_ASSISTANCE'],
      activeAdministratorCount: 1,
    },
  ])(
    'rejects $name when no other active administrator remains',
    ({
      currentActive,
      currentRoles,
      nextActive,
      nextRoles,
      activeAdministratorCount,
    }) => {
      expect(() =>
        assertAdministratorRemains(
          currentActive,
          currentRoles,
          nextActive,
          nextRoles,
          activeAdministratorCount,
        ),
      ).toThrowError(
        expect.objectContaining({
          name: AccountRuleError.name,
          rule: 'LAST_ACTIVE_ADMINISTRATOR',
        }),
      );
    },
  );

  it.each<AdministratorTransition>([
    {
      name: 'preserving the active administrator',
      currentActive: true,
      currentRoles: ['ADMINISTRATOR'],
      nextActive: true,
      nextRoles: ['ADMINISTRATOR', 'SOCIAL_ASSISTANCE'],
      activeAdministratorCount: 1,
    },
    {
      name: 'deactivating one of two administrators',
      currentActive: true,
      currentRoles: ['ADMINISTRATOR'],
      nextActive: false,
      nextRoles: ['ADMINISTRATOR'],
      activeAdministratorCount: 2,
    },
    {
      name: 'removing one of two administrator roles',
      currentActive: true,
      currentRoles: ['ADMINISTRATOR'],
      nextActive: true,
      nextRoles: ['SOCIAL_ASSISTANCE'],
      activeAdministratorCount: 2,
    },
    {
      name: 'changing an inactive administrator',
      currentActive: false,
      currentRoles: ['ADMINISTRATOR'],
      nextActive: false,
      nextRoles: ['SOCIAL_ASSISTANCE'],
      activeAdministratorCount: 1,
    },
    {
      name: 'deactivating a non-administrator',
      currentActive: true,
      currentRoles: ['SOCIAL_ASSISTANCE'],
      nextActive: false,
      nextRoles: ['SOCIAL_ASSISTANCE'],
      activeAdministratorCount: 1,
    },
  ])(
    'allows $name',
    ({
      currentActive,
      currentRoles,
      nextActive,
      nextRoles,
      activeAdministratorCount,
    }) => {
      expect(() =>
        assertAdministratorRemains(
          currentActive,
          currentRoles,
          nextActive,
          nextRoles,
          activeAdministratorCount,
        ),
      ).not.toThrow();
    },
  );
});
