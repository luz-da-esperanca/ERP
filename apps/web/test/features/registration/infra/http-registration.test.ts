import { describe, expect, it, vi } from 'vitest';
import { HttpRegistration } from '../../../../src/registration';
import { ApiClient } from '../../../../src/shared/api-client';

const family = {
  id: '00000000-0000-4000-8000-000000000011',
  code: '11',
  referenceName: 'Synthetic family',
  address: null,
  neighborhood: null,
  postalCode: null,
  location: null,
  contactPhone: null,
  revision: 3,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

describe('HTTP registration', () => {
  it('searches duplicates by CPF when the registered name has one character', async () => {
    const candidate = {
      id: '00000000-0000-4000-8000-000000000020',
      entityType: 'PERSON',
      reasons: ['CPF_MATCH'],
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: [candidate] }));
    const registration = new HttpRegistration(new ApiClient(fetcher));
    expect(
      await registration.reviewPersonDuplicates({
        name: 'A',
        cpf: '12345678901',
        birthDate: null,
        sex: null,
        rg: null,
        occupation: null,
        educationLevel: null,
        contactPhone: null,
        familyId: family.id,
        expectedFamilyRevision: family.revision,
        validFrom: family.createdAt,
        relationshipToReference: null,
        isReference: false,
      }),
    ).toEqual([candidate]);
    const url = new URL(String(fetcher.mock.lastCall?.[0]), 'http://localhost');
    expect(url.pathname).toBe('/api/v1/duplicate-candidates');
    expect(url.searchParams.get('cpf')).toBe('12345678901');
    expect(url.searchParams.has('name')).toBe(false);
  });

  it('preserves matching name and birth evidence for candidates found through CPF', async () => {
    const personId = '00000000-0000-4000-8000-000000000020';
    const otherId = '00000000-0000-4000-8000-000000000021';
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (value) => {
      const url = new URL(String(value), 'http://localhost');
      if (url.pathname.endsWith('/duplicate-candidates'))
        return Response.json({
          data: [personId, otherId].map((id) => ({
            id,
            entityType: 'PERSON',
            reasons: ['CPF_MATCH'],
          })),
        });
      return Response.json({
        data: {
          person: {
            id: url.pathname.endsWith(personId) ? personId : otherId,
            name: url.pathname.endsWith(personId) ? 'A' : 'B',
            birthDate: '1990-01-01',
            cpf: '12345678901',
            sex: null,
            rg: null,
            occupation: null,
            educationLevel: null,
            contactPhone: null,
            revision: 1,
            createdAt: family.createdAt,
            updatedAt: family.updatedAt,
          },
          memberships: [],
          currentFamily: null,
          sizeProfile: null,
        },
      });
    });
    const registration = new HttpRegistration(new ApiClient(fetcher));
    const result = await registration.reviewPersonDuplicates({
      name: 'Á',
      cpf: '12345678901',
      birthDate: '1990-01-01',
      sex: null,
      rg: null,
      occupation: null,
      educationLevel: null,
      contactPhone: null,
      familyId: family.id,
      expectedFamilyRevision: family.revision,
      validFrom: family.createdAt,
      relationshipToReference: null,
      isReference: false,
    });
    expect(result).toEqual([
      {
        id: personId,
        entityType: 'PERSON',
        reasons: ['CPF_MATCH', 'NAME_BIRTH_MATCH'],
      },
      { id: otherId, entityType: 'PERSON', reasons: ['CPF_MATCH'] },
    ]);
  });

  it('reviews long addresses through the bounded search and the complete family address', async () => {
    const address = `Rua ${'da Associação '.repeat(20)}fim`;
    const candidate = {
      id: family.id,
      entityType: 'FAMILY',
      reasons: ['ADDRESS_SIMILAR'],
    };
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (value) => {
      const url = new URL(String(value), 'http://localhost');
      return url.pathname.endsWith('/duplicate-candidates')
        ? Response.json({ data: [candidate] })
        : Response.json({
            data: {
              family: {
                ...family,
                address: address.toUpperCase(),
                memberCount: 0,
                referencePersonName: null,
              },
              members: [],
            },
          });
    });
    const registration = new HttpRegistration(new ApiClient(fetcher));
    expect(
      await registration.reviewFamilyDuplicates({
        referenceName: null,
        address,
        neighborhood: null,
        postalCode: null,
        location: null,
        contactPhone: null,
      }),
    ).toEqual([candidate]);
    const query = new URL(
      String(fetcher.mock.calls[0]?.[0]),
      'http://localhost',
    ).searchParams.get('address');
    expect(query).toBeTruthy();
    expect(query!.length).toBeLessThanOrEqual(200);
    expect(address.startsWith(query!)).toBe(true);
    expect(fetcher.mock.lastCall?.[0]).toBe(`/api/v1/families/${family.id}`);
  });

  it('removes prefix-only address matches while preserving independent name evidence', async () => {
    const address = `Rua ${'da Associação '.repeat(20)}fim`;
    const nameId = '00000000-0000-4000-8000-000000000012';
    const nameOnlyId = '00000000-0000-4000-8000-000000000013';
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (value) => {
      const url = new URL(String(value), 'http://localhost');
      if (url.pathname.endsWith('/duplicate-candidates'))
        return Response.json({
          data: [
            {
              id: family.id,
              entityType: 'FAMILY',
              reasons: ['ADDRESS_SIMILAR'],
            },
            {
              id: nameId,
              entityType: 'FAMILY',
              reasons: ['NAME_SIMILAR', 'ADDRESS_SIMILAR'],
            },
            { id: nameOnlyId, entityType: 'FAMILY', reasons: ['NAME_SIMILAR'] },
          ],
        });
      if (url.pathname.endsWith(nameOnlyId))
        throw new Error('Name-only candidates do not need address lookup');
      return Response.json({
        data: {
          family: {
            ...family,
            id: url.pathname.endsWith(nameId) ? nameId : family.id,
            address: `${address.slice(0, 200)}different ending`,
            memberCount: 0,
            referencePersonName: null,
          },
          members: [],
        },
      });
    });
    const registration = new HttpRegistration(new ApiClient(fetcher));
    expect(
      await registration.reviewFamilyDuplicates({
        referenceName: 'Matching name',
        address,
        neighborhood: null,
        postalCode: null,
        location: null,
        contactPhone: null,
      }),
    ).toEqual([
      { id: nameId, entityType: 'FAMILY', reasons: ['NAME_SIMILAR'] },
      { id: nameOnlyId, entityType: 'FAMILY', reasons: ['NAME_SIMILAR'] },
    ]);
  });

  it('sends the displayed revision and the caller operation key without silently retrying conflicts', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: family }));
    const registration = new HttpRegistration(new ApiClient(fetcher));
    const key = '00000000-0000-4000-8000-000000000012';
    await registration.updateFamily(
      family.id,
      2,
      {
        referenceName: 'Synthetic family',
        address: null,
        neighborhood: null,
        postalCode: null,
        location: null,
        contactPhone: null,
      },
      key,
    );
    expect(fetcher.mock.lastCall?.[1]).toMatchObject({
      method: 'PATCH',
      headers: { 'Idempotency-Key': key, 'X-ERP-Request': '1' },
    });
    expect(JSON.parse(String(fetcher.mock.lastCall?.[1]?.body))).toMatchObject({
      expectedRevision: 2,
      contactPhone: null,
    });
    fetcher.mockResolvedValue(
      Response.json(
        { error: { code: 'REVISION_CONFLICT', requestId: 'conflict' } },
        { status: 409 },
      ),
    );
    await expect(
      registration.updateFamily(
        family.id,
        2,
        {
          referenceName: null,
          address: null,
          neighborhood: null,
          postalCode: null,
          location: null,
          contactPhone: null,
        },
        key,
      ),
    ).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('loads historical family codes from their own families rather than the current family', async () => {
    const personId = '00000000-0000-4000-8000-000000000020';
    const historicalFamilyId = '00000000-0000-4000-8000-000000000030';
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      if (String(url).includes('/people/'))
        return Response.json({
          data: {
            person: {
              id: personId,
              name: 'Synthetic person',
              birthDate: null,
              sex: null,
              cpf: null,
              rg: null,
              occupation: null,
              educationLevel: null,
              contactPhone: null,
              revision: 1,
              createdAt: family.createdAt,
              updatedAt: family.updatedAt,
            },
            memberships: [
              {
                id: '00000000-0000-4000-8000-000000000040',
                personId,
                familyId: historicalFamilyId,
                relationshipToReference: null,
                isReference: false,
                validFrom: family.createdAt,
                validUntil: family.updatedAt,
                revision: 2,
              },
            ],
            currentFamily: { id: family.id, code: family.code },
            sizeProfile: null,
          },
        });
      return Response.json({
        data: {
          family: {
            ...family,
            id: historicalFamilyId,
            code: '30',
            memberCount: 0,
            referencePersonName: null,
          },
          members: [],
        },
      });
    });
    const detail = await new HttpRegistration(new ApiClient(fetcher)).getPerson(
      personId,
    );
    expect(detail.memberships[0]?.familyCode).toBe('30');
    expect(detail.person.birthDate).toBeNull();
    expect(fetcher.mock.lastCall?.[0]).toContain(
      `/families/${historicalFamilyId}`,
    );
  });

  it('uses server search and pagination and preserves unknown values and the reference composition', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        data: [{ ...family, memberCount: 0, referencePersonName: null }],
        pagination: { page: 2, pageSize: 20, total: 21 },
      }),
    );
    const registration = new HttpRegistration(new ApiClient(fetcher));
    const result = await registration.searchFamilies({
      q: 'Luz & paz',
      page: 2,
      pageSize: 20,
    });
    const url = new URL(String(fetcher.mock.lastCall?.[0]), 'http://localhost');
    expect(url.pathname).toBe('/api/v1/families');
    expect(url.searchParams.get('q')).toBe('Luz & paz');
    expect(url.searchParams.get('page')).toBe('2');
    expect(result.pagination.total).toBe(21);
    expect(result.data[0]).toMatchObject({
      contactPhone: null,
      memberCount: 0,
      referencePersonName: null,
    });
    expect(fetcher.mock.lastCall?.[1]).toMatchObject({
      credentials: 'include',
      cache: 'no-store',
    });
  });
});
