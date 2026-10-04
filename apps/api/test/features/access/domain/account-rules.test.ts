import { describe, expect, it } from 'vitest';
import type { Role } from '@erp/contracts/access';
import {
  assertAdministratorRemains,
  assertRevision,
} from '../../../../src/features/access/domain/account-rules.js';

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
          status: 409,
          code: 'REVISION_CONFLICT',
          details: { currentRevision: 3 },
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
          status: 422,
          code: 'BUSINESS_RULE_VIOLATION',
          details: { rule: 'LAST_ACTIVE_ADMINISTRATOR' },
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
