import { expect } from 'vitest';
import type { setupIntegrationFixture } from './integration-fixture.js';
import {
  attendanceContextSchema,
  sessionResultSchema,
} from '@erp/contracts/attendance-api';
import type { AttendanceContextDto } from '@erp/contracts/attendance-api';
type Fixture = ReturnType<typeof setupIntegrationFixture>;
export function markingContextFor(row: AttendanceContextDto['rows'][number]) {
  if (
    row.familyId === null ||
    row.expectedFamilyRevision === null ||
    row.membershipId === null ||
    row.expectedMembershipRevision === null
  )
    throw new Error('Expected a resolved historical membership');
  return {
    personId: row.personId,
    expectedPersonRevision: row.expectedPersonRevision,
    familyId: row.familyId,
    expectedFamilyRevision: row.expectedFamilyRevision,
    membershipId: row.membershipId,
    expectedMembershipRevision: row.expectedMembershipRevision,
  };
}
export function markingFor(
  row: AttendanceContextDto['rows'][number],
  status: 'PRESENT' | 'ABSENT',
) {
  return { ...markingContextFor(row), status };
}
export async function previewCall(
  fixture: Fixture,
  cookie: string,
  activityId: string,
  occurredAt: string,
  guestPersonIds: string[] = [],
  sessionId?: string,
) {
  const query = new URLSearchParams({ occurredAt });
  if (guestPersonIds.length)
    query.set('guestPersonIds', guestPersonIds.join(','));
  if (sessionId) query.set('sessionId', sessionId);
  const response = await fixture.runtime.app.inject({
    method: 'GET',
    url: `/api/v1/activities/${activityId}/attendance-context?${query}`,
    headers: fixture.headers(cookie),
  });
  expect(response.statusCode, response.body).toBe(200);
  return attendanceContextSchema.parse(response.json().data);
}
export async function confirmCall(
  fixture: Fixture,
  cookie: string,
  activityId: string,
  responsibleId: string,
  occurredAt: string,
  entries: { personId: string; status: 'PRESENT' | 'ABSENT' }[] = [],
) {
  const preview = await previewCall(
    fixture,
    cookie,
    activityId,
    occurredAt,
    entries.map((row) => row.personId),
  );
  const payload = {
    occurredAt: preview.occurredAt,
    responsibleId,
    expectedActivityRevision: preview.expectedActivityRevision,
    expectedRosterFingerprint: preview.rosterFingerprint,
    entries: entries.map((entry) =>
      markingFor(
        preview.rows.find((row) => row.personId === entry.personId)!,
        entry.status,
      ),
    ),
  };
  const response = await fixture.runtime.app.inject({
    method: 'POST',
    url: `/api/v1/activities/${activityId}/sessions`,
    headers: fixture.headers(cookie),
    payload,
  });
  expect(response.statusCode, response.body).toBe(201);
  return sessionResultSchema.parse(response.json().data);
}
export async function enrollPerson(
  fixture: Fixture,
  cookie: string,
  activityId: string,
  personId: string,
  validFrom = '2026-01-01T03:00:00Z',
  validUntil: string | null = null,
) {
  const current = await fixture.runtime.app.inject({
    method: 'GET',
    url: `/api/v1/activities/${activityId}`,
    headers: fixture.headers(cookie),
  });
  const response = await fixture.runtime.app.inject({
    method: 'POST',
    url: `/api/v1/activities/${activityId}/enrollments`,
    headers: fixture.headers(cookie),
    payload: {
      expectedActivityRevision: current.json().data.activity.revision,
      personId,
      validFrom,
      validUntil,
    },
  });
  expect(response.statusCode, response.body).toBe(201);
  return response.json().data;
}
