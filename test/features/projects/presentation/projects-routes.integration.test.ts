import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';

const fixture = setupIntegrationFixture();

describe('Projects catalogs HTTP API', () => {
  it('keeps inactive service types readable in existing activities and rejects new selection', async () => {
    const actor = await fixture.operator('synthetic.coordination', [
      'COORDINATION',
    ]);
    const app = fixture.runtime.app;
    const headers = () => fixture.headers(actor.cookie);
    const type = (
      await app.inject({
        method: 'POST',
        url: '/api/v1/service-types',
        headers: headers(),
        payload: { code: 'SYNTHETIC_TYPE', name: 'Tipo sintético' },
      })
    ).json().data;
    const institute = (
      await app.inject({
        method: 'GET',
        url: '/api/v1/institutes',
        headers: headers(),
      })
    ).json().data[0];
    const project = (
      await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: headers(),
        payload: { name: 'Synthetic Point Project', instituteId: institute.id },
      })
    ).json().data;
    const activityResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/activities`,
      headers: headers(),
      payload: {
        expectedProjectRevision: 1,
        name: 'Synthetic Point Activity',
        nature: 'ONE_OFF',
        serviceTypeId: type.id,
      },
    });
    expect(activityResponse.statusCode, activityResponse.body).toBe(201);
    const activity = activityResponse.json().data;
    const disabled = await app.inject({
      method: 'PATCH',
      url: `/api/v1/service-types/${type.id}`,
      headers: headers(),
      payload: {
        expectedRevision: 1,
        active: false,
        reason: 'Synthetic disabled type',
      },
    });
    expect(disabled.statusCode, disabled.body).toBe(200);
    const inactive = await app.inject({
      method: 'GET',
      url: '/api/v1/service-types?active=false',
      headers: headers(),
    });
    expect(inactive.json().data.map((item: { id: string }) => item.id)).toEqual(
      [type.id],
    );
    const renamed = await app.inject({
      method: 'PATCH',
      url: `/api/v1/activities/${activity.id}`,
      headers: headers(),
      payload: { expectedRevision: 1, name: 'Synthetic Renamed Point' },
    });
    expect(renamed.statusCode, renamed.body).toBe(200);
    expect(renamed.json().data.serviceTypeId).toBe(type.id);
    const newActivity = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/activities`,
      headers: headers(),
      payload: {
        expectedProjectRevision: 2,
        name: 'Synthetic Invalid New Point',
        nature: 'ONE_OFF',
        serviceTypeId: type.id,
      },
    });
    expect(newActivity.statusCode, newActivity.body).toBe(422);
    expect(newActivity.json().error.details.rule).toBe('INACTIVE_CATALOG');
    const enrollment = await app.inject({
      method: 'POST',
      url: `/api/v1/activities/${activity.id}/enrollments`,
      headers: headers(),
      payload: {
        expectedActivityRevision: 2,
        personId: randomUUID(),
        validFrom: '2026-01-01T03:00:00Z',
      },
    });
    expect(enrollment.statusCode, enrollment.body).toBe(422);
    expect(enrollment.json().error.details.rule).toBe('INVALID_ACTIVITY_TYPE');
  });
  it('replays an unchanged initial institute after its name changes without adding a no-op audit entry', async () => {
    const actor = await fixture.operator('synthetic.coordination', [
      'COORDINATION',
    ]);
    const app = fixture.runtime.app;
    const institute = (
      await app.inject({
        method: 'GET',
        url: '/api/v1/institutes',
        headers: fixture.headers(actor.cookie),
      })
    )
      .json()
      .data.find((item: { code: string }) => item.code === 'CHILD');
    const request = {
      method: 'PATCH' as const,
      url: `/api/v1/institutes/${institute.id}`,
      headers: fixture.headers(actor.cookie),
      payload: {
        expectedRevision: institute.revision,
        name: institute.name,
        reason: 'Synthetic no-op',
      },
    };
    const noOp = await app.inject(request);
    expect(noOp.statusCode, noOp.body).toBe(200);
    const changed = await app.inject({
      ...request,
      headers: fixture.headers(actor.cookie),
      payload: { ...request.payload, name: 'Instituto sintético renomeado' },
    });
    expect(changed.statusCode, changed.body).toBe(200);
    const replay = await app.inject(request);
    expect(replay.statusCode, replay.body).toBe(200);
    expect(replay.json()).toEqual(noOp.json());
    const audit = await app.inject({
      method: 'GET',
      url: `/api/v1/audit-entries?entityType=Institute&entityId=${institute.id}`,
      headers: fixture.headers(actor.cookie),
    });
    expect(audit.json().data).toHaveLength(1);
  });
  it('lists six institutes and updates a catalog with immutable code, audit and replay', async () => {
    const actor = await fixture.operator('synthetic.coordination', [
      'COORDINATION',
    ]);
    const app = fixture.runtime.app;
    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/institutes',
      headers: fixture.headers(actor.cookie),
    });
    expect(list.statusCode, list.body).toBe(200);
    expect(
      list
        .json()
        .data.map((item: { code: string }) => item.code)
        .sort(),
    ).toEqual([
      'CHARITY',
      'CHILD',
      'COMMUNICATION',
      'EDUCATION_FAMILY',
      'MEDIUMSHIP',
      'YOUTH',
    ]);
    const institute = list
      .json()
      .data.find((item: { code: string }) => item.code === 'CHILD');
    const request = {
      method: 'PATCH' as const,
      url: `/api/v1/institutes/${institute.id}`,
      headers: fixture.headers(actor.cookie),
      payload: {
        expectedRevision: institute.revision,
        active: false,
        reason: 'Synthetic catalog update',
      },
    };
    const changed = await app.inject(request);
    expect(changed.statusCode, changed.body).toBe(200);
    expect(changed.json().data).toMatchObject({
      code: 'CHILD',
      active: false,
      revision: institute.revision + 1,
    });
    expect((await app.inject(request)).json()).toEqual(changed.json());
    expect(
      (
        await app.inject({
          ...request,
          headers: fixture.headers(actor.cookie),
          payload: { ...request.payload, code: 'RENAMED' },
        })
      ).statusCode,
    ).toBe(400);
    const audit = await app.inject({
      method: 'GET',
      url: `/api/v1/audit-entries?entityType=Institute&entityId=${institute.id}`,
      headers: fixture.headers(actor.cookie),
    });
    expect(audit.statusCode, audit.body).toBe(200);
    expect(audit.json().data).toHaveLength(1);
    expect(audit.json().data[0]).toMatchObject({
      before: { active: true },
      after: { active: false },
      reason: 'Synthetic catalog update',
    });
    const type = await app.inject({
      method: 'POST',
      url: '/api/v1/service-types',
      headers: fixture.headers(actor.cookie),
      payload: { code: 'SYNTHETIC_VISIT', name: 'Visita sintética' },
    });
    expect(type.statusCode, type.body).toBe(201);
    expect(type.json().data).toMatchObject({
      code: 'SYNTHETIC_VISIT',
      revision: 1,
      active: true,
    });
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/service-types',
          headers: fixture.headers(actor.cookie),
          payload: { code: 'SYNTHETIC_VISIT', name: 'Duplicado' },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/api/v1/service-types',
          headers: fixture.headers(fixture.adminCookie),
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/api/v1/institutes/${randomUUID()}`,
          headers: fixture.headers(actor.cookie),
          payload: request.payload,
        })
      ).statusCode,
    ).toBe(404);
  });
});

describe('Projects and activities HTTP API', () => {
  it('creates and edits projects and activities with catalog validation, revisions and authorized queries', async () => {
    const actor = await fixture.operator('synthetic.coordination', [
      'COORDINATION',
    ]);
    const social = await fixture.operator('synthetic.social', [
      'SOCIAL_ASSISTANCE',
    ]);
    const app = fixture.runtime.app;
    const headers = () => fixture.headers(actor.cookie);
    const institutes = (
      await app.inject({
        method: 'GET',
        url: '/api/v1/institutes?active=true',
        headers: headers(),
      })
    ).json().data;
    const institute = institutes.find(
      (item: { code: string }) => item.code === 'CHARITY',
    );
    const projectRequest = {
      method: 'POST' as const,
      url: '/api/v1/projects',
      headers: headers(),
      payload: {
        name: 'Ação Sintética',
        instituteId: institute.id,
        startsOn: '2026-01-01',
        endsOn: '2026-12-31',
      },
    };
    const created = await app.inject(projectRequest);
    expect(created.statusCode, created.body).toBe(201);
    const project = created.json().data;
    expect(project).toMatchObject({
      status: 'ACTIVE',
      revision: 1,
      description: null,
      createdBy: actor.user.id,
      updatedBy: actor.user.id,
    });
    expect((await app.inject(projectRequest)).json()).toEqual(created.json());
    const invalidPeriod = await app.inject({
      ...projectRequest,
      headers: headers(),
      payload: { ...projectRequest.payload, startsOn: '2027-01-01' },
    });
    expect(invalidPeriod.statusCode, invalidPeriod.body).toBe(422);
    const activityRequest = {
      method: 'POST' as const,
      url: `/api/v1/projects/${project.id}/activities`,
      headers: headers(),
      payload: {
        expectedProjectRevision: 1,
        name: 'Oficina Sintética',
        nature: 'PERIODIC',
        responsibleId: actor.user.id,
      },
    };
    const activityResponse = await app.inject(activityRequest);
    expect(activityResponse.statusCode, activityResponse.body).toBe(201);
    const activity = activityResponse.json().data;
    expect(activity).toMatchObject({
      revision: 1,
      nature: 'PERIODIC',
      serviceTypeId: null,
      plannedSchedule: null,
      responsibleId: actor.user.id,
    });
    expect((await app.inject(activityRequest)).json()).toEqual(
      activityResponse.json(),
    );
    expect(
      (await app.inject({ ...activityRequest, headers: headers() })).statusCode,
    ).toBe(409);
    const pointType = (
      await app.inject({
        method: 'POST',
        url: '/api/v1/service-types',
        headers: headers(),
        payload: { code: 'SYNTHETIC_POINT', name: 'Tipo sintético' },
      })
    ).json().data;
    const changed = await app.inject({
      method: 'PATCH',
      url: `/api/v1/activities/${activity.id}`,
      headers: headers(),
      payload: {
        expectedRevision: 1,
        nature: 'ONE_OFF',
        serviceTypeId: pointType.id,
      },
    });
    expect(changed.statusCode, changed.body).toBe(200);
    const noOp = await app.inject({
      method: 'PATCH',
      url: `/api/v1/activities/${activity.id}`,
      headers: headers(),
      payload: { expectedRevision: 2, name: activity.name },
    });
    expect(noOp.json().data.revision).toBe(2);
    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/activities/${activity.id}?asOf=2026-03-01T12:00:00Z`,
      headers: fixture.headers(social.cookie),
    });
    expect(detail.statusCode, detail.body).toBe(200);
    expect(detail.json().data).toMatchObject({
      activity: { nature: 'ONE_OFF' },
      project: { revision: 2 },
      participantCount: 0,
    });
    const search = await app.inject({
      method: 'GET',
      url: '/api/v1/projects?q=acao&pageSize=1',
      headers: headers(),
    });
    expect(search.statusCode, search.body).toBe(200);
    expect(search.json().data.map((item: { id: string }) => item.id)).toEqual([
      project.id,
    ]);
    expect(
      (
        await app.inject({
          ...projectRequest,
          headers: fixture.headers(social.cookie),
        })
      ).statusCode,
    ).toBe(403);
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/institutes/${institute.id}`,
      headers: headers(),
      payload: {
        expectedRevision: institute.revision,
        active: false,
        reason: 'Synthetic inactive institute',
      },
    });
    expect(
      (await app.inject({ ...projectRequest, headers: headers() })).statusCode,
    ).toBe(422);
    const renamed = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${project.id}`,
      headers: headers(),
      payload: { expectedRevision: 2, name: 'Projeto sintético renomeado' },
    });
    expect(renamed.statusCode, renamed.body).toBe(200);
    expect(renamed.json().data).toMatchObject({
      instituteId: institute.id,
      description: null,
      revision: 3,
    });
    const audit = await app.inject({
      method: 'GET',
      url: `/api/v1/audit-entries?entityType=Activity&entityId=${activity.id}`,
      headers: headers(),
    });
    expect(audit.statusCode, audit.body).toBe(200);
    expect(audit.json().data).toHaveLength(2);
  });
});
