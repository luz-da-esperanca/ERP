import { expect, it, vi } from 'vitest';
import { HttpComposition } from '../../../../src/registration';
import { ApiClient } from '../../../../src/shared/api-client';
it('validates membership revisions and never sends a reconciliation without the captured fingerprint', async () => {
  const fetcher = vi.fn<typeof fetch>();
  const client = new HttpComposition(new ApiClient(fetcher));
  await expect(
    client.reconcile(
      '00000000-0000-4000-8000-000000000001',
      { reason: 'Synthetic correction' } as never,
      '00000000-0000-4000-8000-000000000002',
    ),
  ).rejects.toBeDefined();
  expect(fetcher).not.toHaveBeenCalled();
});
it('reads size revisions and the complete historical membership detail from the public person response', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const date = '2026-10-05T12:00:00Z';
  const person = {
    id,
    name: 'Synthetic',
    birthDate: null,
    sex: null,
    cpf: null,
    rg: null,
    occupation: null,
    educationLevel: null,
    contactPhone: null,
    revision: 2,
    createdAt: date,
    updatedAt: date,
  };
  const data = {
    person,
    currentFamily: null,
    memberships: [],
    sizeProfile: {
      personId: id,
      shoeSize: '38',
      clothingSize: null,
      informedOn: '2026-10-05',
      revision: 3,
    },
  };
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ data }));
  expect(await new HttpComposition(new ApiClient(fetcher)).person(id)).toEqual(
    data,
  );
});
