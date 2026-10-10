import { describe, expect, it, vi } from 'vitest';
import { ProjectsService } from '../../../../src/features/projects/application/projects-service.js';
import type {
  ProjectsReader,
  ProjectsTransaction,
  ProjectsUnitOfWork,
} from '../../../../src/features/projects/application/projects-ports.js';
import { createAccessServiceFixture } from '../../../support/access-service-fixture.js';
import { createAccountsServiceFixture } from '../../../support/accounts-service-fixture.js';
import type { Principal } from '../../../../src/features/access/application/ports.js';

function fixture() {
  const { principal: original } = createAccessServiceFixture();
  const principal: Principal = {
    ...original,
    user: { ...original.user, roleCodes: ['COORDINATION'] },
  };
  const ports = {
    findActor: vi
      .fn<ProjectsTransaction['findActor']>()
      .mockResolvedValue(principal),
    findOperation: vi.fn<ProjectsTransaction['findOperation']>(),
  };
  // Unconfigured external effects fail immediately in these authorization tests.
  const tx = new Proxy(ports, {
    get(target, key) {
      if (key in target) return Reflect.get(target, key);
      throw new Error(`Unexpected transaction port: ${String(key)}`);
    },
  }) as unknown as ProjectsTransaction;
  const unitOfWork: ProjectsUnitOfWork = {
    run: async (_actor, work) => work(tx),
  };
  const reader = {
    catalogs: vi.fn(),
    projects: vi.fn(),
    activities: vi.fn(),
    project: vi.fn(),
    activity: vi.fn(),
    enrollments: vi.fn(),
  } satisfies ProjectsReader;
  const service = new ProjectsService(
    reader,
    unitOfWork,
    createAccountsServiceFixture().fingerprints,
    () => '2026-10-05T12:00:00.000Z',
    'America/Fortaleza',
  );
  return {
    service,
    principal,
    ports,
    reader,
    context: { actor: principal, key: '00000000-0000-4000-8000-000000000003' },
  };
}
describe('Projects command authorization', () => {
  it.each(['revoked', 'inactive'] as const)(
    'rejects a %s author before reading an idempotent result',
    async (state) => {
      const { service, principal, ports, context } = fixture();
      ports.findActor.mockResolvedValue(
        state === 'revoked'
          ? { ...principal, authVersion: principal.authVersion + 1 }
          : { ...principal, user: { ...principal.user, active: false } },
      );
      await expect(
        service.createServiceType(context, {
          code: 'SYNTHETIC',
          name: 'Synthetic',
        }),
      ).rejects.toMatchObject({ message: 'Authentication required' });
      expect(ports.findOperation).not.toHaveBeenCalled();
    },
  );
  it('uses the current locked permissions instead of the request roles', async () => {
    const { service, principal, ports, context } = fixture();
    ports.findActor.mockResolvedValue({
      ...principal,
      user: { ...principal.user, roleCodes: ['ADMINISTRATOR'] },
    });
    await expect(
      service.createServiceType(context, {
        code: 'SYNTHETIC',
        name: 'Synthetic',
      }),
    ).rejects.toMatchObject({ message: 'Operation not permitted' });
    expect(ports.findOperation).not.toHaveBeenCalled();
  });
  it('requires password change before catalog queries and command replay', async () => {
    const { service, principal, ports, context, reader } = fixture();
    const locked = {
      ...principal,
      user: { ...principal.user, mustChangePassword: true },
    };
    ports.findActor.mockResolvedValue(locked);
    await expect(
      service.createServiceType(context, {
        code: 'SYNTHETIC',
        name: 'Synthetic',
      }),
    ).rejects.toMatchObject({ rule: 'PASSWORD_CHANGE_REQUIRED' });
    expect(() =>
      service.catalogs(locked, 'Institute', { page: 1, pageSize: 20 }),
    ).toThrow('Operation not permitted');
    expect(reader.catalogs).not.toHaveBeenCalled();
  });
  it('starts an enrollment at the server clock when the client omits validFrom', async () => {
    const { service, ports, context } = fixture();
    const extra = {
      findOperation: vi.fn().mockResolvedValue(null),
      createOperation: vi.fn().mockResolvedValue('operation'),
      findActivity: vi.fn().mockResolvedValue({
        id: 'activity',
        projectId: 'project',
        revision: 3,
        nature: 'PERIODIC',
        closedAt: null,
      }),
      findProject: vi.fn().mockResolvedValue({
        startsOn: null,
        endsOn: null,
        closedAt: null,
      }),
      personExists: vi.fn().mockResolvedValue(true),
      // Stops the use case right after the date-dependent rule under test.
      hasFamilyMembership: vi.fn().mockResolvedValue(false),
    };
    Object.assign(ports, extra);
    await expect(
      service.createEnrollment(context, 'activity', {
        expectedActivityRevision: 3,
        personId: 'person',
        validUntil: null,
      }),
    ).rejects.toMatchObject({ rule: 'PERSON_WITHOUT_MEMBERSHIP' });
    expect(extra.hasFamilyMembership).toHaveBeenCalledWith(
      'person',
      '2026-10-05T12:00:00.000Z',
    );
  });
});
