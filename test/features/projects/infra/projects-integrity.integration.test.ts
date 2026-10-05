import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';
import {
  createPeriodicActivity,
  createParticipant,
} from '../../../support/projects-fixture.js';

const fixture = setupIntegrationFixture();
describe('Projects PostgreSQL integrity', () => {
  it('returns the same original project for simultaneous retries and conflicts when the key changes intention', async () => {
    const actor = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    const app = fixture.runtime.app;
    const institute = (
      await app.inject({
        method: 'GET',
        url: '/api/v1/institutes',
        headers: fixture.headers(actor.cookie),
      })
    ).json().data[0];
    const request = {
      method: 'POST' as const,
      url: '/api/v1/projects',
      headers: fixture.headers(actor.cookie),
      payload: {
        name: 'Synthetic Idempotent Project',
        instituteId: institute.id,
      },
    };
    const responses = await Promise.all([
      app.inject(request),
      app.inject(request),
      app.inject(request),
    ]);
    expect(responses.map((response) => response.statusCode)).toEqual([
      201, 201, 201,
    ]);
    expect(responses[1]!.json()).toEqual(responses[0]!.json());
    expect(responses[2]!.json()).toEqual(responses[0]!.json());
    const changed = await app.inject({
      ...request,
      payload: { ...request.payload, name: 'Synthetic Other Intention' },
    });
    expect(changed.statusCode, changed.body).toBe(409);
    expect(changed.json().error.code).toBe('IDEMPOTENCY_CONFLICT');
  });
  it('rolls back the complete closure cascade and allows retrying the same key when audit fails', async () => {
    const actor = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    const { project, activity } = await createPeriodicActivity(
      fixture,
      actor.cookie,
    );
    const { person } = await createParticipant(fixture, actor.cookie);
    const app = fixture.runtime.app;
    const enrollment = await app.inject({
      method: 'POST',
      url: `/api/v1/activities/${activity.id}/enrollments`,
      headers: fixture.headers(actor.cookie),
      payload: {
        expectedActivityRevision: 1,
        personId: person.id,
        validFrom: '2026-01-01T03:00:00Z',
      },
    });
    expect(enrollment.statusCode, enrollment.body).toBe(201);
    const request = {
      method: 'POST' as const,
      url: `/api/v1/projects/${project.id}/closure`,
      headers: fixture.headers(actor.cookie),
      payload: {
        expectedRevision: 2,
        effectiveAt: '2026-03-01T03:00:00Z',
        reason: 'Synthetic atomic closure',
      },
    };
    await fixture.runtime.database.$executeRawUnsafe(
      'ALTER TABLE "AuditEntry" ADD CONSTRAINT test_reject_project_closure CHECK ("entityType" <> \'Project\' OR action <> \'CLOSE\')',
    );
    try {
      expect((await app.inject(request)).statusCode).toBe(500);
      const projectDetail = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}`,
        headers: fixture.headers(actor.cookie),
      });
      expect(projectDetail.json().data.project).toMatchObject({
        status: 'ACTIVE',
        revision: 2,
      });
      expect(projectDetail.json().data.activities[0]).toMatchObject({
        status: 'ACTIVE',
        revision: 2,
      });
      const intervals = await app.inject({
        method: 'GET',
        url: `/api/v1/activities/${activity.id}/enrollments`,
        headers: fixture.headers(actor.cookie),
      });
      expect(intervals.json().data[0].enrollment).toMatchObject({
        revision: 1,
        validUntil: null,
      });
    } finally {
      await fixture.runtime.database.$executeRawUnsafe(
        'ALTER TABLE "AuditEntry" DROP CONSTRAINT test_reject_project_closure',
      );
    }
    expect((await app.inject(request)).statusCode).toBe(200);
  });
  it('rejects overlapping enrollment periods and catalog code rewrites at the database boundary', async () => {
    const actor = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    const { project, activity } = await createPeriodicActivity(
      fixture,
      actor.cookie,
    );
    const { person } = await createParticipant(fixture, actor.cookie);
    const database = fixture.runtime.database;
    const input = {
      activityId: activity.id,
      personId: person.id,
      validFrom: new Date('2026-01-01T03:00:00Z'),
      validUntil: new Date('2026-02-01T03:00:00Z'),
      createdBy: actor.user.id,
      updatedBy: actor.user.id,
    };
    await database.participantEnrollment.create({ data: input });
    await expect(
      database.participantEnrollment.create({
        data: { ...input, validFrom: new Date('2026-01-15T03:00:00Z') },
      }),
    ).rejects.toThrow();
    await expect(
      database.participantEnrollment.create({
        data: { ...input, validFrom: input.validUntil },
      }),
    ).rejects.toThrow();
    await expect(
      database.participantEnrollment.create({
        data: { ...input, validFrom: input.validUntil, validUntil: null },
      }),
    ).resolves.toMatchObject({ activityId: activity.id });
    await expect(
      database.institute.update({
        where: { id: project.instituteId },
        data: { code: 'OTHER_CODE' },
      }),
    ).rejects.toThrow();
    await expect(
      database.activity.update({
        where: { id: activity.id },
        data: { nature: 'ONE_OFF' },
      }),
    ).rejects.toThrow();
  });
  it('resolves competing authors sharing an idempotency key into one project and a conflict', async () => {
    const first = await fixture.operator('synthetic.first', ['COORDINATION']);
    const second = await fixture.operator('synthetic.second', ['COORDINATION']);
    const institute = (
      await fixture.runtime.app.inject({
        method: 'GET',
        url: '/api/v1/institutes',
        headers: fixture.headers(first.cookie),
      })
    ).json().data[0];
    const key = randomUUID();
    const responses = await Promise.all(
      [first, second].map((actor) =>
        fixture.runtime.app.inject({
          method: 'POST',
          url: '/api/v1/projects',
          headers: fixture.headers(actor.cookie, key),
          payload: {
            name: 'Synthetic Concurrent Project',
            instituteId: institute.id,
          },
        }),
      ),
    );
    expect(responses.map((response) => response.statusCode).sort()).toEqual([
      201, 409,
    ]);
    const list = await fixture.runtime.app.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: fixture.headers(first.cookie),
    });
    expect(list.json().pagination.total).toBe(1);
  });
  it('serializes enrollment against a concurrent change of activity nature', async () => {
    const coordinator = await fixture.operator('synthetic.coordinator', [
      'COORDINATION',
    ]);
    const manager = await fixture.operator('synthetic.manager', [
      'ACTIVITY_MANAGER',
    ]);
    const { activity } = await createPeriodicActivity(
      fixture,
      coordinator.cookie,
    );
    const { person } = await createParticipant(fixture, coordinator.cookie);
    const app = fixture.runtime.app;
    const type = (
      await app.inject({
        method: 'POST',
        url: '/api/v1/service-types',
        headers: fixture.headers(coordinator.cookie),
        payload: { code: 'SYNTHETIC', name: 'Synthetic Type' },
      })
    ).json().data;
    const [change, enrollment] = await Promise.all([
      app.inject({
        method: 'PATCH',
        url: `/api/v1/activities/${activity.id}`,
        headers: fixture.headers(coordinator.cookie),
        payload: {
          expectedRevision: 1,
          nature: 'ONE_OFF',
          serviceTypeId: type.id,
        },
      }),
      app.inject({
        method: 'POST',
        url: `/api/v1/activities/${activity.id}/enrollments`,
        headers: fixture.headers(manager.cookie),
        payload: {
          expectedActivityRevision: 1,
          personId: person.id,
          validFrom: '2026-01-01T03:00:00Z',
        },
      }),
    ]);
    expect([change.statusCode, enrollment.statusCode]).toSatisfy(
      (statuses: number[]) =>
        statuses.includes(409) &&
        (statuses.includes(200) || statuses.includes(201)),
    );
    const detail = (
      await app.inject({
        method: 'GET',
        url: `/api/v1/activities/${activity.id}?asOf=2026-02-01T03:00:00Z`,
        headers: fixture.headers(coordinator.cookie),
      })
    ).json().data;
    expect(
      detail.activity.nature === 'PERIODIC' ? detail.participantCount : 0,
    ).toBe(enrollment.statusCode === 201 ? 1 : 0);
  });
});
