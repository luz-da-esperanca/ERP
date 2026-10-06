import { expect } from 'vitest';
import type { setupIntegrationFixture } from './integration-fixture.js';
import { socialFormContextSchema } from '@erp/contracts/social-forms-api';
import type { SocialFieldKey } from '@erp/contracts/social-form-fields';

type Fixture = ReturnType<typeof setupIntegrationFixture>;
export async function configureSocialFields(
  fixture: Fixture,
  cookie: string,
  keys: SocialFieldKey[] = ['housing.roomCount'],
) {
  const response = await fixture.runtime.app.inject({
    method: 'POST',
    url: '/api/v1/social-form-field-selections',
    headers: fixture.headers(cookie),
    payload: {
      expectedRevision: null,
      decisionReference: 'SYNTHETIC-TEST',
      reason: 'Synthetic field configuration',
      fields: keys.map((fieldKey) => ({
        fieldKey,
        included: true,
        required: false,
        appliesTo: fieldKey.startsWith('members[].')
          ? fieldKey.startsWith('members[].health') ||
            fieldKey === 'members[].medications'
            ? 'REFERENCE_MEMBER'
            : 'ALL_MEMBERS'
          : 'FAMILY',
        allowedRoleCodes: ['COORDINATION', 'SOCIAL_ASSISTANCE'],
        cardinality:
          fieldKey === 'members[].medications' ||
          fieldKey === 'needs.declaredNeeds'
            ? 'MULTIPLE'
            : 'SINGLE',
        purpose: 'Synthetic evaluation',
        decisionReference: 'SYNTHETIC-TEST',
      })),
    },
  });
  expect(response.statusCode, response.body).toBe(201);
  for (const block of new Set(
    keys.map((key) => key.replace('members[].', '').split('.')[0]!),
  )) {
    const enabled = await fixture.runtime.app.inject({
      method: 'POST',
      url: `/api/v1/feature-decisions/FIC_${block === 'medications' ? 'MEDICATION' : block.toUpperCase()}`,
      headers: fixture.headers(cookie),
      payload: {
        enabled: true,
        expectedRevision: null,
        decisionReference: 'SYNTHETIC-TEST',
        reason: 'Synthetic block configuration',
      },
    });
    expect(enabled.statusCode, enabled.body).toBe(200);
  }
  return response.json().data;
}
export async function createSocialFamily(fixture: Fixture, cookie: string) {
  const family = await fixture.runtime.app.inject({
    method: 'POST',
    url: '/api/v1/families',
    headers: fixture.headers(cookie),
    payload: { address: 'Synthetic old address' },
  });
  expect(family.statusCode, family.body).toBe(201);
  const person = await fixture.runtime.app.inject({
    method: 'POST',
    url: '/api/v1/people',
    headers: fixture.headers(cookie),
    payload: {
      name: 'Synthetic reference member',
      familyId: family.json().data.id,
      expectedFamilyRevision: family.json().data.revision,
      validFrom: '2026-01-01T00:00:00Z',
      isReference: true,
    },
  });
  expect(person.statusCode, person.body).toBe(201);
  return person.json().data;
}
export async function previewSocialForm(
  fixture: Fixture,
  cookie: string,
  familyId: string,
  occurredAt = '2026-10-01T12:00:00Z',
) {
  const response = await fixture.runtime.app.inject({
    method: 'GET',
    url: `/api/v1/families/${familyId}/social-form-context?occurredAt=${encodeURIComponent(occurredAt)}`,
    headers: fixture.headers(cookie),
  });
  expect(response.statusCode, response.body).toBe(200);
  return socialFormContextSchema.parse(response.json().data);
}
export function socialPublicationInput(
  context: Awaited<ReturnType<typeof previewSocialForm>>,
) {
  return {
    occurredAt: context.occurredAt,
    expectedFamilyRevision: context.expectedFamilyRevision,
    expectedPreviousVersionId: context.expectedPreviousVersionId,
    fieldSelectionVersionId: context.fieldSelectionVersionId,
    memberRevisions: context.memberRevisions,
    blocks: { housing: { roomCount: null } },
    members: [],
  };
}
