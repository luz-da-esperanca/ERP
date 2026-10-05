import { describe, expect, it, vi } from 'vitest';
import { RegistrationService } from '../../../../src/features/registration/application/registration-service.js';
import type {
  RegistrationReader,
  RegistrationTransaction,
  RegistrationUnitOfWork,
} from '../../../../src/features/registration/application/registration-ports.js';
import { createAccessServiceFixture } from '../../../support/access-service-fixture.js';
import { createAccountsServiceFixture } from '../../../support/accounts-service-fixture.js';
import { PermissionDeniedError } from '../../../../src/features/access/domain/account-errors.js';

function fixture() {
  const { principal } = createAccessServiceFixture();
  principal.user.roleCodes = ['SOCIAL_ASSISTANCE'];
  const reader = {
    family: vi.fn(),
    person: vi.fn(),
    families: vi.fn(),
    membership: vi.fn(),
    people: vi.fn(),
    duplicateRecords: vi.fn(),
    qualityIssues: vi.fn(),
  } satisfies RegistrationReader;
  const ports = {
    findActor: vi
      .fn<RegistrationTransaction['findActor']>()
      .mockResolvedValue(principal),
    findOperation: vi
      .fn<RegistrationTransaction['findOperation']>()
      .mockResolvedValue(null),
    findFamily: vi
      .fn<RegistrationTransaction['findFamily']>()
      .mockResolvedValue({
        id: 'family',
        code: '1',
        revision: 1,
        referenceName: null,
        address: null,
        neighborhood: null,
        postalCode: null,
        location: null,
        contactPhone: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
  };
  // Guard unconfigured external calls so the focused tests cannot accidentally persist effects.
  const tx = new Proxy(ports, {
    get(target, key) {
      if (key in target) return Reflect.get(target, key);
      throw new Error(`Unexpected transaction port: ${String(key)}`);
    },
  }) as unknown as RegistrationTransaction;
  const unitOfWork: RegistrationUnitOfWork = {
    run: async (_actor, _families, work) => work(tx),
  };
  const { fingerprints } = createAccountsServiceFixture();
  const service = new RegistrationService(
    reader,
    unitOfWork,
    fingerprints,
    () => '2026-10-05T01:00:00.000Z',
    () => '2026-10-04',
    'America/Fortaleza',
  );
  return {
    service,
    principal,
    ports,
    context: { actor: principal, key: 'operation' },
  };
}
describe('Registration command protection', () => {
  it('revalidates a revoked session before reading an operation or registration data', async () => {
    const { service, principal, ports, context } = fixture();
    ports.findActor.mockResolvedValue({
      ...principal,
      authVersion: principal.authVersion + 1,
    });
    await expect(
      service.updateFamily(context, 'family', {
        expectedRevision: 1,
        address: null,
      }),
    ).rejects.toMatchObject({ message: 'Authentication required' });
    expect(ports.findOperation).not.toHaveBeenCalled();
    expect(ports.findFamily).not.toHaveBeenCalled();
  });
  it('uses the locked author permissions rather than the earlier request roles', async () => {
    const { service, principal, ports, context } = fixture();
    ports.findActor.mockResolvedValue({
      ...principal,
      user: { ...principal.user, roleCodes: ['ADMINISTRATOR'] },
    });
    await expect(
      service.updateFamily(context, 'family', {
        expectedRevision: 1,
        address: null,
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(ports.findOperation).not.toHaveBeenCalled();
  });
  it('compares birth dates to the configured civil day near the UTC midnight boundary', async () => {
    const { service, context } = fixture();
    await expect(
      service.createPerson(context, {
        name: 'Synthetic Person',
        familyId: 'family',
        expectedFamilyRevision: 1,
        validFrom: '2026-01-01T00:00:00.000Z',
        birthDate: '2026-10-05',
        sex: null,
        cpf: null,
        rg: null,
        occupation: null,
        educationLevel: null,
        contactPhone: null,
        relationshipToReference: null,
        isReference: false,
      }),
    ).rejects.toMatchObject({ rule: 'FUTURE_BIRTH_DATE' });
  });
});
