import { describe, expect, it } from 'vitest';
import {
  eligibilityRecordsQuerySchema,
  frequencyReportQuerySchema,
  historyQuerySchema,
  qualityReportQuerySchema,
  reachRecordsQuerySchema,
  reachReportQuerySchema,
} from '../src/reports-api';

const id = '00000000-0000-4000-8000-000000000001';
const period = { from: '2026-01-01', toExclusive: '2026-02-01' };

describe('Report HTTP queries', () => {
  it('requires an ordered civil period and accepts only the filters of the report', () => {
    expect(reachReportQuerySchema.parse({ ...period, projectId: id })).toEqual({
      ...period,
      projectId: id,
    });
    for (const query of [
      { from: '2026-02-01', toExclusive: '2026-02-01' },
      { from: '2026-01-01T00:00:00Z', toExclusive: '2026-02-01' },
      { ...period, familyId: id },
      { from: '2026-01-01' },
    ])
      expect(reachReportQuerySchema.safeParse(query).success).toBe(false);
    expect(frequencyReportQuerySchema.safeParse(period).success).toBe(false);
    expect(
      frequencyReportQuerySchema.safeParse({ ...period, activityId: id })
        .success,
    ).toBe(true);
  });
  it('demands the fingerprint of the consulted total to open its detail', () => {
    const detail = {
      ...period,
      unit: 'PERSON',
      expectedQueryFingerprint: 'a'.repeat(64),
    };
    expect(reachRecordsQuerySchema.parse(detail)).toEqual({
      ...detail,
      page: 1,
      pageSize: 20,
    });
    for (const query of [
      { ...period, unit: 'PERSON' },
      { ...detail, unit: 'DONATION' },
      { ...detail, pageSize: '101' },
    ])
      expect(reachRecordsQuerySchema.safeParse(query).success).toBe(false);
    expect(
      eligibilityRecordsQuerySchema.safeParse({
        referenceDate: '2026-01-31',
        expectedQueryFingerprint: 'a'.repeat(64),
      }).success,
    ).toBe(false);
  });
  it('states which date selects data quality issues', () => {
    expect(qualityReportQuerySchema.parse(period)).toMatchObject({
      dateBasis: 'IDENTIFICATION',
    });
    expect(
      qualityReportQuerySchema.safeParse({ ...period, dateBasis: 'RECORDING' })
        .success,
    ).toBe(false);
  });
  it('parses history event types as a set and orders newest first by default', () => {
    expect(
      historyQuerySchema.parse({ eventTypes: 'ATTENDANCE,SOCIAL_FORM' }),
    ).toEqual({
      eventTypes: ['ATTENDANCE', 'SOCIAL_FORM'],
      order: 'desc',
      page: 1,
      pageSize: 20,
    });
    for (const query of [
      { eventTypes: 'DELIVERY' },
      { order: 'random' },
      { from: '2026-02-01', toExclusive: '2026-01-01' },
    ])
      expect(historyQuerySchema.safeParse(query).success).toBe(false);
  });
});
