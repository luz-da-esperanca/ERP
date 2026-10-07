import { expect } from 'vitest';
import type { setupIntegrationFixture } from './integration-fixture.js';
import type { ProjectDto, ActivityDto } from '@erp/contracts/projects-api';
import { personRegistrationSchema } from '@erp/contracts/registration-api';

type IntegrationFixture = ReturnType<typeof setupIntegrationFixture>;
export async function createPeriodicActivity(
  fixture: IntegrationFixture,
  cookie: string,
  name = 'Synthetic Project',
) {
  const app = fixture.runtime.app;
  const institute = (
    await app.inject({
      method: 'GET',
      url: '/api/v1/institutes?active=true',
      headers: fixture.headers(cookie),
    })
  ).json().data[0];
  const created = await app.inject({
    method: 'POST',
    url: '/api/v1/projects',
    headers: fixture.headers(cookie),
    payload: {
      name,
      instituteId: institute.id,
      startsOn: '2026-01-01',
      endsOn: '2026-12-31',
    },
  });
  expect(created.statusCode, created.body).toBe(201);
  const project: ProjectDto = created.json().data;
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/projects/${project.id}/activities`,
    headers: fixture.headers(cookie),
    payload: {
      expectedProjectRevision: project.revision,
      name: 'Synthetic Periodic Activity',
      nature: 'PERIODIC',
    },
  });
  expect(response.statusCode, response.body).toBe(201);
  const activity: ActivityDto = response.json().data;
  return { project: { ...project, revision: 2 }, activity };
}
export async function createParticipant(
  fixture: IntegrationFixture,
  cookie: string,
) {
  const app = fixture.runtime.app;
  const familyResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/families',
    headers: fixture.headers(cookie),
    payload: {},
  });
  expect(familyResponse.statusCode, familyResponse.body).toBe(201);
  const family = familyResponse.json().data;
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/people',
    headers: fixture.headers(cookie),
    payload: {
      name: 'Synthetic Participant',
      cpf: '12345678909',
      familyId: family.id,
      expectedFamilyRevision: family.revision,
      validFrom: '2026-01-01T03:00:00Z',
    },
  });
  expect(response.statusCode, response.body).toBe(201);
  return personRegistrationSchema.parse(response.json().data);
}
