import { describe, expect, it } from 'vitest';
import {
  summarizeFrequency,
  coveredPeriods,
  civilBoundary,
  assertSessionDate,
  changedIntervalPeriods,
  frequencyOpportunities,
} from '../../../../src/features/attendance/domain/frequency-rules.js';
import type { FrequencyOpportunity } from '../../../../src/features/attendance/domain/attendance.js';

const opportunity = (
  id: string,
  status: 'PRESENT' | 'ABSENT' | null,
  familyId: string | null = 'old-family',
): FrequencyOpportunity => ({
  personId: 'person',
  sessionId: id,
  occurredAt: '2026-01-05T13:00:00Z',
  familyId,
  membershipId: familyId ? 'membership' : null,
  membershipRevision: familyId ? 1 : null,
  sessionRevision: 1,
  enrollmentRevisions: [],
  relevance: 'ENROLLMENT',
  contextResolved: familyId !== null,
  attendance: status
    ? {
        id,
        sessionId: id,
        personId: 'person',
        familyId: familyId!,
        membershipId: 'membership',
        membershipRevision: 1,
        status,
        recordedAt: '2026-01-06T13:00:00Z',
        recordedBy: 'operator',
        revision: 1,
        supersededById: null,
      }
    : null,
});
describe('Frequency evidence', () => {
  it('invalidates only the opportunity interval changed by enrollment closure', () => {
    expect(
      changedIntervalPeriods(
        { validFrom: '2026-01-01T03:00:00.000Z', validUntil: null },
        {
          validFrom: '2026-01-01T03:00:00.000Z',
          validUntil: '2026-01-10T03:00:00.000Z',
        },
      ),
    ).toEqual([{ from: '2026-01-10T03:00:00.000Z', toExclusive: null }]);
  });
  it('preserves known counts and unknown percentage until both coverage and markings are complete', () => {
    const rows = [
      opportunity('1', 'PRESENT'),
      opportunity('2', 'ABSENT'),
      opportunity('3', null),
    ];
    expect(summarizeFrequency(rows, false)).toMatchObject({
      sessionCount: 3,
      presenceCount: 1,
      absenceCount: 1,
      unrecordedCount: 1,
      attendanceRate: null,
      isComplete: false,
    });
    expect(summarizeFrequency(rows.slice(0, 2), true)).toMatchObject({
      sessionCount: 2,
      attendanceRate: 50,
      isComplete: true,
    });
    expect(summarizeFrequency([], true)).toMatchObject({
      sessionCount: 0,
      attendanceRate: null,
    });
  });
  it('filters historical family before counting while retaining unresolved context', () => {
    const rows = [
      opportunity('old', 'PRESENT'),
      opportunity('new', 'ABSENT', 'new-family'),
      opportunity('unknown', null, null),
    ];
    expect(summarizeFrequency(rows, true, 'old-family')).toMatchObject({
      sessionCount: 1,
      presenceCount: 1,
      contextComplete: false,
      attendanceRate: null,
    });
  });
  it('subtracts invalidated days and joins adjacent valid declarations', () => {
    expect(
      coveredPeriods('2026-01-01', '2026-01-10', [
        {
          periodStart: '2026-01-01',
          periodEndExclusive: '2026-01-10',
          invalidatedPeriods: [
            { from: '2026-01-05', toExclusive: '2026-01-06' },
          ],
        },
        {
          periodStart: '2026-01-05',
          periodEndExclusive: '2026-01-06',
          invalidatedPeriods: [],
        },
      ]),
    ).toEqual({
      confirmedPeriods: [{ from: '2026-01-01', toExclusive: '2026-01-10' }],
      gaps: [],
      isComplete: true,
    });
  });
  it('uses the configured civil midnight and an exclusive closure cut', () => {
    expect(civilBoundary('2026-01-01', 'America/Fortaleza')).toBe(
      '2026-01-01T03:00:00.000Z',
    );
    expect(() =>
      assertSessionDate(
        { nature: 'PERIODIC', closedAt: '2026-01-05T13:00:00Z' },
        { startsOn: '2026-01-01', endsOn: null, closedAt: null },
        '2026-01-05T13:00:00Z',
        '2026-01-10T13:00:00Z',
        'America/Fortaleza',
      ),
    ).toThrow();
  });
});

describe('Frequency opportunities of one person', () => {
  const at = (day: string) => `2026-01-${day}T13:00:00.000Z`;
  const session = (id: string, day: string, status = 'COMPLETED') => ({
    id,
    occurredAt: at(day),
    status,
    revision: 1,
  });
  const sources = {
    sessions: [
      session('before', '02'),
      session('enrolled', '10'),
      session('guest', '20'),
      session('canceled', '12', 'CANCELED'),
      session('later', '25'),
    ],
    enrollments: [
      {
        id: 'enrollment',
        personId: 'person',
        validFrom: at('05'),
        validUntil: at('15'),
        revision: 3,
      },
    ],
    attendances: [
      {
        id: 'mark',
        sessionId: 'guest',
        personId: 'person',
        familyId: 'recorded-family',
        membershipId: 'recorded-membership',
        membershipRevision: 2,
        status: 'PRESENT',
      },
      { id: 'other', sessionId: 'enrolled', personId: 'someone-else' },
    ],
    people: [
      {
        id: 'person',
        memberships: [
          {
            id: 'membership',
            familyId: 'family',
            validFrom: at('01'),
            validUntil: null,
            revision: 1,
          },
        ],
      },
    ],
  } as unknown as Parameters<typeof frequencyOpportunities>[0];
  it('includes sessions with a valid enrollment or an explicit marking, never earlier or canceled ones', () => {
    const rows = frequencyOpportunities(sources, 'person', at('01'), at('22'));
    expect(
      rows.map((row) => [
        row.sessionId,
        row.relevance,
        row.familyId,
        row.attendance?.id ?? null,
      ]),
    ).toEqual([
      ['enrolled', 'ENROLLMENT', 'family', null],
      ['guest', 'RECORDED', 'recorded-family', 'mark'],
    ]);
    expect(rows[0]!.enrollmentRevisions).toEqual([
      {
        entityType: 'ParticipantEnrollment',
        entityId: 'enrollment',
        revision: 3,
      },
    ]);
  });
  it('marks the context unresolved when no membership covers an unmarked opportunity', () => {
    const [row] = frequencyOpportunities(
      { ...sources, people: [{ ...sources.people[0]!, memberships: [] }] },
      'person',
      at('01'),
      at('15'),
    );
    expect(row).toMatchObject({ familyId: null, contextResolved: false });
  });
});
