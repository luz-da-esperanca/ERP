import { describe, expect, it } from 'vitest';
import {
  createSessionSchema,
  updateAttendanceSchema,
  coverageDeclarationSchema,
} from '../src/attendance-api';

const id = '00000000-0000-4000-8000-000000000001';
describe('Attendance HTTP inputs', () => {
  it('normalizes entry sets and preserves explicitly selected unmarked guests', () => {
    const other = '00000000-0000-4000-8000-000000000002';
    const entry = (personId: string) => ({
      personId,
      expectedPersonRevision: 1,
      familyId: id,
      expectedFamilyRevision: 1,
      membershipId: id,
      expectedMembershipRevision: 1,
      status: 'PRESENT',
    });
    const parsed = createSessionSchema.parse({
      occurredAt: '2026-01-01T13:00:00Z',
      responsibleId: id,
      expectedActivityRevision: 1,
      expectedRosterFingerprint: 'a'.repeat(64),
      guestPersonIds: [other, id],
      entries: [entry(other), entry(id)],
    });
    expect(parsed.entries.map((row) => row.personId)).toEqual([id, other]);
    expect(parsed.guestPersonIds).toEqual([id, other]);
  });
  it('normalizes instants without inventing attendance for an empty call', () => {
    const input = createSessionSchema.parse({
      occurredAt: '2026-01-01T10:00:00-03:00',
      responsibleId: id,
      expectedActivityRevision: 1,
      expectedRosterFingerprint: 'a'.repeat(64),
      entries: [],
    });
    expect(input.occurredAt).toBe('2026-01-01T13:00:00.000Z');
    expect(input.entries).toEqual([]);
    expect(
      createSessionSchema.safeParse({ ...input, familyId: id }).success,
    ).toBe(false);
  });
  it('requires explicit status and historical context for a first marking', () => {
    const base = {
      expectedSessionRevision: 1,
      expectedRosterFingerprint: 'a'.repeat(64),
      reason: 'Synthetic correction',
    };
    expect(
      updateAttendanceSchema.safeParse({
        ...base,
        entries: [{ personId: id, expectedRevision: null, status: 'PRESENT' }],
      }).success,
    ).toBe(false);
    expect(
      updateAttendanceSchema.safeParse({
        ...base,
        entries: [{ personId: id, expectedRevision: 1, status: 'UNRECORDED' }],
      }).success,
    ).toBe(false);
  });
  it('requires explicit coverage confirmation and an ordered civil interval', () => {
    const input = {
      periodStart: '2026-01-01',
      periodEndExclusive: '2026-02-01',
      expectedActivityRevision: 1,
      expectedSourceFingerprint: 'b'.repeat(64),
      confirmed: true,
      reason: 'Synthetic declaration',
    };
    expect(coverageDeclarationSchema.safeParse(input).success).toBe(true);
    expect(
      coverageDeclarationSchema.safeParse({ ...input, confirmed: false })
        .success,
    ).toBe(false);
    expect(
      coverageDeclarationSchema.safeParse({
        ...input,
        periodEndExclusive: '2026-01-01',
      }).success,
    ).toBe(false);
  });
});
