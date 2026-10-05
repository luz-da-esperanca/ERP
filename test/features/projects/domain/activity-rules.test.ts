import { describe, expect, it } from 'vitest';
import {
  assertEnrollmentInterval,
  assertClosurePlan,
  assertProjectPeriod,
  assertActivityNature,
  assertEnrollmentAvailability,
} from '../../../../src/features/projects/domain/activity-rules.js';

describe('Periodic participant enrollment', () => {
  it('accepts a historical interval and rejects one outside the project or exclusive closure boundary', () => {
    const activity = {
      nature: 'PERIODIC' as const,
      closedAt: '2026-04-01T03:00:00Z',
    };
    const project = {
      startsOn: '2026-01-01',
      endsOn: '2026-04-01',
      closedAt: null,
    };
    const now = '2026-10-01T12:00:00Z';
    expect(() =>
      assertEnrollmentInterval(
        activity,
        project,
        '2026-01-01T03:00:00Z',
        '2026-04-01T03:00:00Z',
        now,
        'America/Fortaleza',
      ),
    ).not.toThrow();
    expect(() =>
      assertEnrollmentInterval(
        activity,
        project,
        '2026-04-01T03:00:00Z',
        null,
        now,
        'America/Fortaleza',
      ),
    ).toThrow('Enrollment falls outside activity validity');
    expect(() =>
      assertEnrollmentInterval(
        activity,
        project,
        '2026-01-01T02:59:59Z',
        null,
        now,
        'America/Fortaleza',
      ),
    ).toThrow('Enrollment falls outside activity validity');
  });
  it('requires a service type only for one-off activities and validates the known project period', () => {
    expect(() => assertActivityNature('PERIODIC', null)).not.toThrow();
    expect(() => assertActivityNature('PERIODIC', 'type')).toThrow();
    expect(() => assertActivityNature('ONE_OFF', null)).toThrow();
    expect(() => assertProjectPeriod('2026-03-01', '2026-02-01')).toThrow();
    expect(() => assertProjectPeriod(null, '2026-02-01')).not.toThrow();
  });
  it('rejects a closure at an enrollment start and preserves an earlier activity closure', () => {
    const activities = [{ id: 'activity', closedAt: '2026-02-01T03:00:00Z' }];
    const enrollments = [
      {
        id: 'enrollment',
        validFrom: '2026-03-01T03:00:00Z',
        supersededById: null,
      },
    ];
    expect(() =>
      assertClosurePlan(
        activities,
        enrollments,
        '2026-03-01T03:00:00Z',
        '2026-10-01T12:00:00Z',
      ),
    ).toThrow();
    expect(() =>
      assertClosurePlan(
        activities,
        enrollments,
        '2026-04-01T03:00:00Z',
        '2026-10-01T12:00:00Z',
      ),
    ).not.toThrow();
    expect(() =>
      assertClosurePlan([], [], '2027-01-01T00:00:00Z', '2026-10-01T12:00:00Z'),
    ).toThrow();
  });
  it('allows adjacent intervals and ignores superseded enrollment facts', () => {
    const rows = [
      {
        id: 'old',
        personId: 'person',
        validFrom: '2026-01-01T00:00:00Z',
        validUntil: '2026-02-01T00:00:00Z',
        supersededById: null,
      },
    ];
    expect(() =>
      assertEnrollmentAvailability(
        rows,
        'person',
        '2026-02-01T00:00:00Z',
        null,
      ),
    ).not.toThrow();
    expect(() =>
      assertEnrollmentAvailability(
        rows,
        'person',
        '2026-01-15T00:00:00Z',
        null,
      ),
    ).toThrow();
    expect(() =>
      assertEnrollmentAvailability(
        [{ ...rows[0]!, supersededById: 'successor' }],
        'person',
        '2026-01-15T00:00:00Z',
        null,
      ),
    ).not.toThrow();
  });
});
