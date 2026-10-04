import { describe, expect, it } from 'vitest';
import { passwordSchema, createUserSchema } from '../src/access-api';
describe('Access contracts', () => {
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
