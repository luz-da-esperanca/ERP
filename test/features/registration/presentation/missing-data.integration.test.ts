import { describe, expect, it } from 'vitest';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';
import { randomUUID } from 'node:crypto';

const fixture = setupIntegrationFixture();

describe('Informative missing registration data', () => {
  it('restricts configuration and its audit, rejects stale versions and replays the original selection without duplicate occurrences', async () => {
    const coordinator = await fixture.operator('synthetic.coordination', [
      'COORDINATION',
    ]);
    const social = await fixture.operator('synthetic.social', [
      'SOCIAL_ASSISTANCE',
    ]);
    const send = (
      cookie: string,
      method: 'GET' | 'POST',
      url: string,
      payload?: object,
      key?: ReturnType<typeof randomUUID>,
    ) =>
      fixture.runtime.app.inject({
        method,
        url: `/api/v1${url}`,
        headers: fixture.headers(cookie, key),
        ...(payload ? { payload } : {}),
      });
    expect(
      (
        await send(
          coordinator.cookie,
          'GET',
          '/registration-field-selections/current',
        )
      ).json().data,
    ).toBeNull();
    const input = {
      expectedVersion: null,
      personFields: [],
      familyFields: ['contactPhone'],
      decisionReference: 'Synthetic demo selection',
    };
    expect(
      (
        await send(
          social.cookie,
          'POST',
          '/registration-field-selections',
          input,
        )
      ).statusCode,
    ).toBe(403);
    const family = (
      await send(coordinator.cookie, 'POST', '/families', {})
    ).json().data;
    const key = randomUUID();
    const first = await send(
      coordinator.cookie,
      'POST',
      '/registration-field-selections',
      input,
      key,
    );
    expect(first.statusCode, first.body).toBe(201);
    const selection = first.json().data;
    expect(
      (
        await send(
          coordinator.cookie,
          'POST',
          '/registration-field-selections',
          input,
          key,
        )
      ).json().data,
    ).toEqual(selection);
    expect(
      (
        await send(
          coordinator.cookie,
          'POST',
          '/registration-field-selections',
          input,
        )
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await send(
          coordinator.cookie,
          'POST',
          '/registration-field-selections',
          { ...input, personFields: ['cpf'] },
          key,
        )
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await send(
          coordinator.cookie,
          'GET',
          '/data-quality-issues?kind=MISSING_DATA',
        )
      ).json().data,
    ).toHaveLength(1);
    const audit = await send(
      coordinator.cookie,
      'GET',
      `/audit-entries?entityType=RegistrationFieldSelection&entityId=${selection.id}`,
    );
    expect(audit.statusCode, audit.body).toBe(200);
    expect(audit.json().data).toHaveLength(1);
    expect(audit.json().data[0]).toMatchObject({
      classification: 'REGISTRATION_CONFIGURATION',
      actorId: coordinator.user.id,
      after: selection,
    });
    expect(
      (
        await send(
          social.cookie,
          'GET',
          `/audit-entries?entityType=RegistrationFieldSelection&entityId=${selection.id}`,
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await send(
          fixture.adminCookie,
          'GET',
          '/registration-field-selections/current',
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await send(
          social.cookie,
          'GET',
          '/registration-field-selections/current',
        )
      ).json().data,
    ).toEqual(selection);
    expect(
      (
        await send(
          coordinator.cookie,
          'GET',
          '/data-quality-issues?kind=MISSING_DATA',
        )
      ).json().data[0].entityId,
    ).toBe(family.id);
  });
  it('starts without defaults, backfills explicitly selected fields and completes occurrences atomically without blocking minimal registration', async () => {
    const actor = await fixture.operator('synthetic.coordination', [
      'COORDINATION',
    ]);
    const send = (
      method: 'GET' | 'POST' | 'PATCH',
      url: string,
      payload?: object,
      key?: ReturnType<typeof randomUUID>,
    ) =>
      fixture.runtime.app.inject({
        method,
        url: `/api/v1${url}`,
        headers: fixture.headers(actor.cookie, key),
        ...(payload ? { payload } : {}),
      });
    const familyResponse = await send('POST', '/families', {});
    expect(familyResponse.statusCode, familyResponse.body).toBe(201);
    const family = familyResponse.json().data;
    expect(
      (await send('GET', '/data-quality-issues?kind=MISSING_DATA')).json().data,
    ).toEqual([]);
    const request = {
      expectedVersion: null,
      personFields: ['birthDate'],
      familyFields: ['contactPhone'],
      decisionReference: 'Synthetic demo selection, no institutional approval',
    };
    const selection = await send(
      'POST',
      '/registration-field-selections',
      request,
    );
    expect(selection.statusCode, selection.body).toBe(201);
    const issues = (
      await send('GET', '/data-quality-issues?kind=MISSING_DATA')
    ).json().data;
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      entityId: family.id,
      fieldKeys: ['contactPhone'],
      resolvedAt: null,
    });
    const personResponse = await send('POST', '/people', {
      name: 'Synthetic Missing Data',
      familyId: family.id,
      expectedFamilyRevision: 1,
      validFrom: '2026-01-01T00:00:00Z',
    });
    expect(personResponse.statusCode, personResponse.body).toBe(201);
    const person = personResponse.json().data.person;
    expect(
      (
        await send('GET', '/data-quality-issues?kind=MISSING_DATA&status=OPEN')
      ).json().pagination.total,
    ).toBe(2);
    const updated = await send('PATCH', `/people/${person.id}`, {
      expectedRevision: 1,
      birthDate: '2000-01-01',
    });
    expect(updated.statusCode, updated.body).toBe(200);
    const resolved = (
      await send(
        'GET',
        '/data-quality-issues?kind=MISSING_DATA&status=RESOLVED',
      )
    ).json().data;
    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({
      entityId: person.id,
      fieldKeys: ['birthDate'],
      resolution: 'COMPLETED',
      resolvedBy: actor.user.id,
      revision: 2,
    });
    const audit = await send(
      'GET',
      `/audit-entries?entityType=DataQualityIssue&entityId=${resolved[0].id}`,
    );
    expect(audit.statusCode, audit.body).toBe(200);
    expect(audit.json().data).toHaveLength(2);
    expect(audit.json().data[0]).toMatchObject({
      before: { resolvedAt: null },
      after: { resolution: 'COMPLETED' },
    });
    const removed = await send('PATCH', `/people/${person.id}`, {
      expectedRevision: 2,
      birthDate: null,
    });
    expect(removed.statusCode, removed.body).toBe(200);
    const all = (
      await send('GET', '/data-quality-issues?kind=MISSING_DATA')
    ).json().data;
    expect(
      all.filter((issue: { entityId: string }) => issue.entityId === person.id),
    ).toHaveLength(2);
    const withdrawn = await send('POST', '/registration-field-selections', {
      expectedVersion: 1,
      personFields: [],
      familyFields: [],
      decisionReference: 'Synthetic withdrawal',
    });
    expect(withdrawn.statusCode, withdrawn.body).toBe(201);
    expect(
      (
        await send('GET', '/data-quality-issues?kind=MISSING_DATA&status=OPEN')
      ).json().data,
    ).toEqual([]);
    const report = await send(
      'GET',
      '/reports/data-quality?from=2026-01-01&toExclusive=2027-01-01&kind=MISSING_DATA&dateBasis=RESOLUTION',
    );
    expect(report.statusCode, report.body).toBe(200);
    expect(report.json().data.totals).toEqual({
      total: 3,
      open: 0,
      resolved: 3,
      byKind: { MISSING_DATA: 3, POSSIBLE_DUPLICATE: 0 },
      byResolution: { DISTINCT: 0, MERGED: 0, COMPLETED: 1, NOT_TRACKED: 2 },
    });
    const detail = await send(
      'GET',
      `/reports/data-quality/records?from=2026-01-01&toExclusive=2027-01-01&kind=MISSING_DATA&dateBasis=RESOLUTION&expectedQueryFingerprint=${report.json().data.queryFingerprint}`,
    );
    expect(detail.statusCode, detail.body).toBe(200);
    expect(
      detail
        .json()
        .data.map((row: { id: string }) => row.id)
        .sort(),
    ).toEqual(
      report
        .json()
        .data.data.map((row: { id: string }) => row.id)
        .sort(),
    );
  });
});
