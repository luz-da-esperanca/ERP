import { describe, expect, it, vi } from 'vitest';
import { HttpSocialForms } from '../../../../src/social-forms';
import { ApiClient } from '../../../../src/shared/api-client';

const familyId = '00000000-0000-4000-8000-000000000001';
const personId = '00000000-0000-4000-8000-000000000002';
const formId = '00000000-0000-4000-8000-000000000003';
const selectionId = '00000000-0000-4000-8000-000000000004';
const membershipId = '00000000-0000-4000-8000-000000000005';
const originFamilyId = '00000000-0000-4000-8000-000000000006';
const key = '00000000-0000-4000-8000-000000000007';
const occurredAt = '2026-10-05T12:00:00.000Z';
const family = {
  id: familyId,
  code: '1',
  referenceName: 'Synthetic family',
  address: null,
  neighborhood: null,
  postalCode: null,
  location: null,
  contactPhone: null,
  revision: 3,
  createdAt: occurredAt,
  updatedAt: occurredAt,
};
const field = {
  fieldKey: 'housing.roomCount' as const,
  included: true,
  required: false,
  appliesTo: 'FAMILY' as const,
  allowedRoleCodes: ['COORDINATION' as const],
  cardinality: 'SINGLE' as const,
  purpose: 'Synthetic showcase',
  decisionReference: 'DEMO-SYNTHETIC',
};
const selection = {
  id: selectionId,
  version: 2,
  recordedAt: occurredAt,
  recordedBy: personId,
  decisionReference: 'DEMO-SYNTHETIC',
  fields: [field],
};
const summary = {
  id: formId,
  familyId: originFamilyId,
  version: 1,
  previousVersionId: null,
  correctionOfFormId: null,
  occurredAt,
  recordedAt: occurredAt,
  recordedBy: personId,
  fieldSelectionVersionId: selectionId,
  originFamilyId,
  originalVersion: 1,
};
const form = {
  ...summary,
  referenceMemberId: null,
  familySnapshot: { ...family, id: originFamilyId },
  reason: null,
  blocks: { housing: { roomCount: null } },
  members: [],
  acknowledgement: null,
};
const memberRevisions = [
  {
    personId,
    expectedPersonRevision: 4,
    membershipId,
    expectedMembershipRevision: 5,
    sizeProfilePersonId: null,
    expectedSizeRevision: null,
  },
];
const context = {
  occurredAt,
  family,
  expectedFamilyRevision: 3,
  expectedPreviousVersionId: null,
  latestPublishedFormId: formId,
  referencePersonId: personId,
  fieldSelectionVersionId: selectionId,
  memberRevisions,
  members: [
    {
      person: {
        id: personId,
        name: 'Synthetic person',
        birthDate: null,
        sex: null,
        revision: 4,
      },
      membership: {
        id: membershipId,
        personId,
        familyId,
        relationshipToReference: null,
        isReference: true,
        validFrom: occurredAt,
        validUntil: null,
        revision: 5,
      },
      sizeProfile: null,
    },
  ],
  fieldSelection: selection,
  options: [],
  latestForm: form,
};

describe('HTTP social forms', () => {
  it('loads the composition at the fact time and keeps the canonical predecessor separate from an origin publication', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: context }));
    const onChange = vi.fn();
    const client = new HttpSocialForms(new ApiClient(fetcher), onChange);
    expect(await client.context(familyId, { occurredAt })).toEqual(context);
    expect(fetcher.mock.lastCall?.[0]).toBe(
      `/api/v1/families/${familyId}/social-form-context?occurredAt=2026-10-05T12%3A00%3A00.000Z`,
    );
    expect(fetcher.mock.lastCall?.[1]?.method).toBe('GET');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps version pagination and projected field omissions when reading a published form', async () => {
    const page = {
      data: [summary],
      pagination: { page: 2, pageSize: 10, total: 11 },
    };
    const hiddenBlocks = { ...form, blocks: {} };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(page))
      .mockResolvedValueOnce(Response.json({ data: hiddenBlocks }));
    const onChange = vi.fn();
    const client = new HttpSocialForms(new ApiClient(fetcher), onChange);
    expect(
      await client.list(familyId, {
        page: 2,
        pageSize: 10,
        orderBy: 'occurredAt',
      }),
    ).toEqual(page);
    const url = new URL(String(fetcher.mock.calls[0]?.[0]), 'http://localhost');
    expect(url.pathname).toBe(`/api/v1/families/${familyId}/social-forms`);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: '2',
      pageSize: '10',
      orderBy: 'occurredAt',
    });
    expect(await client.get(formId)).toEqual(hiddenBlocks);
    expect(fetcher.mock.lastCall?.[0]).toBe(`/api/v1/social-forms/${formId}`);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('publishes exactly the captured canonical base, member revisions and declared zero with its operation key', async () => {
    const input = {
      occurredAt,
      expectedFamilyRevision: 3,
      expectedPreviousVersionId: null,
      fieldSelectionVersionId: selectionId,
      memberRevisions,
      referencePersonId: personId,
      blocks: { housing: { roomCount: 0 } },
      members: [],
    };
    const published = {
      ...form,
      familyId,
      originFamilyId: null,
      originalVersion: null,
      familySnapshot: family,
      blocks: { housing: { roomCount: 0 } },
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: published }, { status: 201 }));
    const onChange = vi.fn();
    const client = new HttpSocialForms(new ApiClient(fetcher), onChange);
    expect(await client.publish(familyId, input, key)).toEqual(published);
    expect(fetcher.mock.lastCall?.[0]).toBe(
      `/api/v1/families/${familyId}/social-forms`,
    );
    expect(fetcher.mock.lastCall?.[1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: { 'X-ERP-Request': '1', 'Idempotency-Key': key },
      body: JSON.stringify(input),
    });
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('leaves an unconfigured field selection and disabled decisions untouched when loading available fields', async () => {
    const fields = { selection: null, options: [], decisions: [] };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: fields }));
    const onChange = vi.fn();
    const client = new HttpSocialForms(new ApiClient(fetcher), onChange);
    expect(await client.fields()).toEqual(fields);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.lastCall?.[0]).toBe('/api/v1/social-form-fields');
    expect(fetcher.mock.lastCall?.[1]?.method).toBe('GET');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('publishes the complete explicit selection and records a known paper acknowledgement without creating another form', async () => {
    const selectionInput = {
      expectedRevision: 1,
      decisionReference: 'DEMO-SYNTHETIC',
      reason: 'Synthetic selection update',
      fields: [field],
    };
    const acknowledgementInput = {
      expectedRevision: null,
      referencePersonId: personId,
      method: 'PAPER_SIGNATURE' as const,
      acknowledgedOn: '2026-10-05',
    };
    const acknowledgement = {
      id: membershipId,
      socialFormId: formId,
      referencePersonId: personId,
      method: 'PAPER_SIGNATURE',
      acknowledgedOn: '2026-10-05',
      recordedAt: occurredAt,
      recordedBy: personId,
      revision: 1,
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ data: selection }, { status: 201 }),
      )
      .mockResolvedValueOnce(
        Response.json({ data: acknowledgement }, { status: 201 }),
      );
    const onChange = vi.fn();
    const client = new HttpSocialForms(new ApiClient(fetcher), onChange);
    expect(await client.selectFields(selectionInput, key)).toEqual(selection);
    expect(fetcher.mock.lastCall?.[0]).toBe(
      '/api/v1/social-form-field-selections',
    );
    expect(fetcher.mock.lastCall?.[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify(selectionInput),
      headers: { 'Idempotency-Key': key },
    });
    expect(await client.acknowledge(formId, acknowledgementInput, key)).toEqual(
      acknowledgement,
    );
    expect(fetcher.mock.lastCall?.[0]).toBe(
      `/api/v1/social-forms/${formId}/acknowledgements`,
    );
    expect(fetcher.mock.lastCall?.[1]).toMatchObject({
      method: 'POST',
      headers: { 'Idempotency-Key': key },
    });
    expect(JSON.parse(String(fetcher.mock.lastCall?.[1]?.body))).toEqual(
      acknowledgementInput,
    );
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('creates and deactivates catalog options and changes a feature only through explicit versioned commands', async () => {
    const optionInput = {
      fieldKey: 'housing.location' as const,
      code: 'URBAN',
      label: 'Synthetic urban location',
      active: false,
      isOther: false,
      decisionReference: 'DEMO-SYNTHETIC',
    };
    const option = {
      id: membershipId,
      fieldKey: 'housing.location',
      code: 'URBAN',
      label: 'Synthetic urban location',
      active: false,
      isOther: false,
      revision: 1,
    };
    const optionUpdate = {
      expectedRevision: 1,
      active: false,
      decisionReference: 'DEMO-SYNTHETIC',
      reason: 'Synthetic catalog revision',
    };
    const updatedOption = { ...option, revision: 2 };
    const decisionInput = {
      enabled: false,
      expectedRevision: 5,
      decisionReference: 'DEMO-SYNTHETIC',
      reason: 'Synthetic feature disablement',
    };
    const decision = {
      id: selectionId,
      code: 'FIC_HOUSING',
      enabled: false,
      decisionReference: 'DEMO-SYNTHETIC',
      decidedAt: occurredAt,
      decidedBy: personId,
      revision: 6,
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ data: option }, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ data: updatedOption }))
      .mockResolvedValueOnce(Response.json({ data: decision }));
    const onChange = vi.fn();
    const client = new HttpSocialForms(new ApiClient(fetcher), onChange);
    expect(await client.createOption(optionInput, key)).toEqual(option);
    expect(fetcher.mock.lastCall?.[0]).toBe('/api/v1/social-form-options');
    expect(fetcher.mock.lastCall?.[1]).toMatchObject({
      method: 'POST',
      headers: { 'Idempotency-Key': key },
    });
    expect(JSON.parse(String(fetcher.mock.lastCall?.[1]?.body))).toEqual(
      optionInput,
    );
    expect(await client.updateOption(membershipId, optionUpdate, key)).toEqual(
      updatedOption,
    );
    expect(fetcher.mock.lastCall?.[0]).toBe(
      `/api/v1/social-form-options/${membershipId}`,
    );
    expect(fetcher.mock.lastCall?.[1]).toMatchObject({
      method: 'PATCH',
      headers: { 'Idempotency-Key': key },
    });
    expect(JSON.parse(String(fetcher.mock.lastCall?.[1]?.body))).toEqual(
      optionUpdate,
    );
    expect(
      await client.decideFeature('FIC_HOUSING', decisionInput, key),
    ).toEqual(decision);
    expect(fetcher.mock.lastCall?.[0]).toBe(
      '/api/v1/feature-decisions/FIC_HOUSING',
    );
    expect(fetcher.mock.lastCall?.[1]).toMatchObject({
      method: 'POST',
      headers: { 'Idempotency-Key': key },
    });
    expect(JSON.parse(String(fetcher.mock.lastCall?.[1]?.body))).toEqual(
      decisionInput,
    );
    expect(onChange).toHaveBeenCalledTimes(3);
  });
});

it('reads complete configuration metadata through its separate manager endpoint', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      Response.json({ data: { selection, options: [], decisions: [] } }),
    );
  expect(
    (await new HttpSocialForms(new ApiClient(fetcher)).configuration())
      .selection,
  ).toEqual(selection);
  expect(fetcher.mock.lastCall?.[0]).toBe('/api/v1/social-form-configuration');
});
