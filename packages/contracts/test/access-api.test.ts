import { describe, expect, it } from 'vitest';
import {
  passwordSchema,
  createUserSchema,
  usersPageSchema,
} from '../src/access-api';
describe('Access contracts', () => {
  it('projects paginated public accounts without credentials', () => {
    const account = {
      id: '00000000-0000-4000-8000-000000000001',
      login: 'test.operator',
      displayName: 'Synthetic Operator',
      active: true,
      mustChangePassword: false,
      revision: 1,
      roleCodes: ['ADMINISTRATOR'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(
      usersPageSchema.parse({
        data: [{ ...account, passwordHash: 'private', authVersion: 2 }],
        pagination: { page: 1, pageSize: 20, total: 1 },
      }),
    ).toEqual({
      data: [account],
      pagination: { page: 1, pageSize: 20, total: 1 },
    });
  });
  it('preserves whitespace in passwords and counts Unicode characters separately from bytes', () => {
    expect(passwordSchema.parse('  valid-password  ')).toBe(
      '  valid-password  ',
    );
    expect(passwordSchema.safeParse('é'.repeat(36)).success).toBe(true);
    expect(passwordSchema.safeParse('é'.repeat(37)).success).toBe(false);
    expect(passwordSchema.safeParse('😀'.repeat(11)).success).toBe(false);
    expect(passwordSchema.safeParse('a'.repeat(72)).success).toBe(true);
    expect(passwordSchema.safeParse('a'.repeat(73)).success).toBe(false);
    expect(passwordSchema.safeParse('valid-password\0').success).toBe(false);
  });
  it('normalizes login and role sets while rejecting unexpected fields and duplicate roles', () => {
    const input = {
      login: ' Operator.One ',
      displayName: 'Synthetic Operator',
      initialPassword: 'synthetic-password',
      roleCodes: ['SOCIAL_ASSISTANCE', 'ADMINISTRATOR'],
    };
    expect(createUserSchema.parse(input)).toMatchObject({
      login: 'operator.one',
      roleCodes: ['ADMINISTRATOR', 'SOCIAL_ASSISTANCE'],
    });
    expect(
      createUserSchema.safeParse({ ...input, active: false }).success,
    ).toBe(false);
    expect(
      createUserSchema.safeParse({
        ...input,
        roleCodes: ['ADMINISTRATOR', 'ADMINISTRATOR'],
      }).success,
    ).toBe(false);
  });
});
