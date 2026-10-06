import { describe, expect, it } from 'vitest';
import {
  passwordSchema,
  createUserSchema,
  usersPageSchema,
  sessionDtoSchema,
  responsibleCandidateSchema,
  responsibleCandidatesQuerySchema,
} from '../src/access-api';
describe('Access contracts', () => {
  it('exposes only the identification of a responsible candidate', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    const candidate = { id, displayName: 'Synthetic Operator', active: true };
    expect(responsibleCandidateSchema.parse(candidate)).toEqual(candidate);
    for (const extra of [{ login: 'synthetic' }, { roleCodes: [] }])
      expect(
        responsibleCandidateSchema.safeParse({ ...candidate, ...extra })
          .success,
      ).toBe(false);
    expect(
      responsibleCandidatesQuerySchema.parse({
        ids: `${id},${id}`,
        q: ' Ana ',
      }),
    ).toEqual({ ids: [id], q: 'Ana', page: 1, pageSize: 20 });
    for (const query of [{ ids: 'not-a-uuid' }, { q: 'a' }, { login: 'x' }])
      expect(responsibleCandidatesQuerySchema.safeParse(query).success).toBe(
        false,
      );
  });
  it('validates authenticated session data without inventing capabilities from roles', () => {
    const session = {
      user: {
        id: '00000000-0000-4000-8000-000000000001',
        login: 'synthetic.operator',
        displayName: 'Synthetic Operator',
        active: true,
        mustChangePassword: true,
        revision: 2,
        roleCodes: ['ADMINISTRATOR'],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      roles: ['ADMINISTRATOR'],
      capabilities: ['accounts.manage', 'audit.read'],
    };
    expect(sessionDtoSchema.parse(session)).toEqual(session);
    expect(
      sessionDtoSchema.safeParse({
        ...session,
        capabilities: ['unknown.manage'],
      }).success,
    ).toBe(false);
    expect(
      sessionDtoSchema.safeParse({ ...session, token: 'private' }).success,
    ).toBe(false);
  });
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
