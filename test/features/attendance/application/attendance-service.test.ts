import { describe, expect, it, vi } from 'vitest';
import { AttendanceService } from '../../../../src/features/attendance/application/attendance-service.js';
import type {
  AttendanceReader,
  AttendanceTransaction,
  AttendanceUnitOfWork,
} from '../../../../src/features/attendance/application/attendance-ports.js';
import type { Principal } from '../../../../src/features/access/application/ports.js';
import { createAccessServiceFixture } from '../../../support/access-service-fixture.js';
import { createAccountsServiceFixture } from '../../../support/accounts-service-fixture.js';

function fixture() {
  const { principal: original } = createAccessServiceFixture();
  const principal: Principal = {
    ...original,
    user: { ...original.user, roleCodes: ['ACTIVITY_MANAGER'] },
  };
  const ports = {
    actor: vi.fn<AttendanceTransaction['actor']>().mockResolvedValue(principal),
    operation: vi.fn<AttendanceTransaction['operation']>(),
  };
  // Unexpected external effects must fail if authorization is bypassed.
  const tx = new Proxy(ports, {
    get(target, key) {
      if (key in target) return Reflect.get(target, key);
      throw new Error(`Unexpected transaction port: ${String(key)}`);
    },
  }) as unknown as AttendanceTransaction;
  const unitOfWork: AttendanceUnitOfWork = {
    run: async (_actor, work) => work(tx),
  };
  const reader: AttendanceReader = {
    async read() {
      throw new Error('Unexpected attendance read');
    },
  };
  vi.spyOn(reader, 'read');
  const service = new AttendanceService(
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

describe('Attendance command authorization', () => {
  it.each(['revoked', 'inactive'] as const)(
    'rejects a %s author before looking up an idempotent result',
    async (state) => {
      const { service, principal, ports, context } = fixture();
      ports.actor.mockResolvedValue(
        state === 'revoked'
          ? { ...principal, authVersion: principal.authVersion + 1 }
          : { ...principal, user: { ...principal.user, active: false } },
      );
      await expect(
        service.cancelSession(context, 'synthetic-session', {
          expectedSessionRevision: 1,
          reason: 'Synthetic correction',
        }),
      ).rejects.toMatchObject({ message: 'Authentication required' });
      expect(ports.operation).not.toHaveBeenCalled();
    },
  );
  it('revalidates the current locked capabilities before replay or mutation', async () => {
    const { service, principal, ports, context } = fixture();
    ports.actor.mockResolvedValue({
      ...principal,
      user: { ...principal.user, roleCodes: ['SOCIAL_ASSISTANCE'] },
    });
    await expect(
      service.cancelSession(context, 'synthetic-session', {
        expectedSessionRevision: 1,
        reason: 'Synthetic correction',
      }),
    ).rejects.toMatchObject({ message: 'Operation not permitted' });
    expect(ports.operation).not.toHaveBeenCalled();
  });
  it('rejects password-change accounts before commands and frequency reads', async () => {
    const { service, principal, ports, context, reader } = fixture();
    const locked = {
      ...principal,
      user: { ...principal.user, mustChangePassword: true },
    };
    ports.actor.mockResolvedValue(locked);
    await expect(
      service.cancelSession(context, 'synthetic-session', {
        expectedSessionRevision: 1,
        reason: 'Synthetic correction',
      }),
    ).rejects.toMatchObject({ rule: 'PASSWORD_CHANGE_REQUIRED' });
    expect(ports.operation).not.toHaveBeenCalled();
    expect(() =>
      service.frequency(locked, {
        personId: 'synthetic-person',
        activityId: 'synthetic-activity',
        from: '2026-01-01T03:00:00Z',
        toExclusive: '2026-02-01T03:00:00Z',
      }),
    ).toThrow('Operation not permitted');
    expect(reader.read).not.toHaveBeenCalled();
  });
});
