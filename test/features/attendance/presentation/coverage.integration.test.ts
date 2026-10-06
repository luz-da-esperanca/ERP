import { describe, expect, it } from 'vitest';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';
import {
  createPeriodicActivity,
  createParticipant,
} from '../../../support/projects-fixture.js';
import {
  confirmCall,
  enrollPerson,
} from '../../../support/attendance-fixture.js';
import {
  coverageViewSchema,
  coverageDtoSchema,
} from '@erp/contracts/attendance-api';

describe('Declared attendance coverage', () => {
  const fixture = setupIntegrationFixture();
  it('invalidates the affected interval when a reference change splits an enrolled membership', async () => {
    const operator = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    const { activity } = await createPeriodicActivity(fixture, operator.cookie);
    const { person, family, membership } = await createParticipant(
      fixture,
      operator.cookie,
    );
    await enrollPerson(fixture, operator.cookie, activity.id, person.id);
    const app = fixture.runtime.app;
    const coverageUrl = `/api/v1/activities/${activity.id}/coverage?periodStart=2026-01-01&periodEndExclusive=2026-01-10`;
    const preview = (
      await app.inject({
        method: 'GET',
        url: coverageUrl,
        headers: fixture.headers(operator.cookie),
      })
    ).json().data;
    const declaration = await app.inject({
      method: 'POST',
      url: `/api/v1/activities/${activity.id}/coverage-declarations`,
      headers: fixture.headers(operator.cookie),
      payload: {
        periodStart: preview.periodStart,
        periodEndExclusive: preview.periodEndExclusive,
        expectedActivityRevision: preview.expectedActivityRevision,
        expectedSourceFingerprint: preview.sourceFingerprint,
        confirmed: true,
        reason: 'Synthetic reviewed recess',
      },
    });
    expect(declaration.statusCode, declaration.body).toBe(201);
    const changed = await app.inject({
      method: 'POST',
      url: `/api/v1/families/${family.id}/reference-changes`,
      headers: fixture.headers(operator.cookie),
      payload: {
        membershipId: membership.id,
        expectedRevision: family.revision,
        effectiveAt: '2026-01-06T03:00:00Z',
        reason: 'Synthetic reference change',
      },
    });
    expect(changed.statusCode, changed.body).toBe(200);
    const after = await app.inject({
      method: 'GET',
      url: coverageUrl,
      headers: fixture.headers(operator.cookie),
    });
    expect(after.json().data.gaps).toEqual([
      { from: '2026-01-06', toExclusive: '2026-01-10' },
    ]);
    expect(after.json().data.declarations[0].revision).toBe(2);
  });
  it('requires explicit closed-day coverage and invalidates only days affected by late sessions', async () => {
    const operator = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    const { activity } = await createPeriodicActivity(fixture, operator.cookie);
    const { person } = await createParticipant(fixture, operator.cookie);
    const enrollment = await enrollPerson(
      fixture,
      operator.cookie,
      activity.id,
      person.id,
    );
    await confirmCall(
      fixture,
      operator.cookie,
      activity.id,
      operator.user.id,
      '2026-01-05T13:00:00Z',
      [{ personId: person.id, status: 'PRESENT' }],
    );
    const app = fixture.runtime.app;
    const coverageUrl = `/api/v1/activities/${activity.id}/coverage?periodStart=2026-01-01&periodEndExclusive=2026-01-10`;
    const beforeResponse = await app.inject({
      method: 'GET',
      url: coverageUrl,
      headers: fixture.headers(operator.cookie),
    });
    expect(beforeResponse.statusCode, beforeResponse.body).toBe(200);
    const before = coverageViewSchema.parse(beforeResponse.json().data);
    expect(before.gaps).toEqual([
      { from: '2026-01-01', toExclusive: '2026-01-10' },
    ]);
    const declaration = await app.inject({
      method: 'POST',
      url: `/api/v1/activities/${activity.id}/coverage-declarations`,
      headers: fixture.headers(operator.cookie),
      payload: {
        periodStart: before.periodStart,
        periodEndExclusive: before.periodEndExclusive,
        expectedActivityRevision: before.expectedActivityRevision,
        expectedSourceFingerprint: before.sourceFingerprint,
        confirmed: true,
        reason: 'Synthetic complete register',
      },
    });
    expect(declaration.statusCode, declaration.body).toBe(201);
    const declared = coverageDtoSchema.parse(declaration.json().data);
    const frequencyUrl = `/api/v1/people/${person.id}/frequency?activityId=${activity.id}&from=2026-01-01T03:00:00Z&toExclusive=2026-01-10T03:00:00Z`;
    const complete = await app.inject({
      method: 'GET',
      url: frequencyUrl,
      headers: fixture.headers(operator.cookie),
    });
    expect(complete.json().data).toMatchObject({
      sessionCount: 1,
      presenceCount: 1,
      attendanceRate: 100,
      isComplete: true,
    });
    await confirmCall(
      fixture,
      operator.cookie,
      activity.id,
      operator.user.id,
      '2026-01-05T15:00:00Z',
    );
    const after = await app.inject({
      method: 'GET',
      url: coverageUrl,
      headers: fixture.headers(operator.cookie),
    });
    const view = coverageViewSchema.parse(after.json().data);
    expect(view.gaps).toEqual([
      { from: '2026-01-05', toExclusive: '2026-01-06' },
    ]);
    expect(view.declarations[0]).toMatchObject({
      id: declared.id,
      revision: 2,
      invalidatedPeriods: [{ from: '2026-01-05', toExclusive: '2026-01-06' }],
    });
    const incomplete = await app.inject({
      method: 'GET',
      url: frequencyUrl,
      headers: fixture.headers(operator.cookie),
    });
    expect(incomplete.json().data).toMatchObject({
      sessionCount: 2,
      presenceCount: 1,
      unrecordedCount: 1,
      coverageComplete: false,
      attendanceRate: null,
    });
    const closedEnrollment = await app.inject({
      method: 'POST',
      url: `/api/v1/enrollments/${enrollment.id}/closure`,
      headers: fixture.headers(operator.cookie),
      payload: {
        expectedRevision: 1,
        validUntil: '2026-01-06T03:00:00Z',
        reason: 'Synthetic enrollment closure',
      },
    });
    expect(closedEnrollment.statusCode, closedEnrollment.body).toBe(200);
    const afterEnrollment = await app.inject({
      method: 'GET',
      url: coverageUrl,
      headers: fixture.headers(operator.cookie),
    });
    expect(afterEnrollment.json().data.gaps).toEqual([
      { from: '2026-01-05', toExclusive: '2026-01-10' },
    ]);
    const future = await app.inject({
      method: 'POST',
      url: `/api/v1/activities/${activity.id}/coverage-declarations`,
      headers: fixture.headers(operator.cookie),
      payload: {
        periodStart: '2026-01-01',
        periodEndExclusive: '2099-01-01',
        expectedActivityRevision: view.expectedActivityRevision,
        expectedSourceFingerprint: view.sourceFingerprint,
        confirmed: true,
        reason: 'Synthetic future declaration',
      },
    });
    expect(future.statusCode, future.body).toBe(422);
  });
});
