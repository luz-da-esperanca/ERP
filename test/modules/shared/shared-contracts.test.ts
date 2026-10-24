import { describe, expect, it } from 'vitest';
import {
  InMemoryAuditTrail,
  InMemoryIdempotencyStore,
} from '../../../src/modules/shared/audit-and-idempotency.ts';
import {
  ApplicationError,
  validationFailedError,
} from '../../../src/modules/shared/errors.ts';
import {
  generateUuidV7,
  isUuidV4OrV7,
  isValidIsoCalendarDate,
  isValidPeriod,
} from '../../../src/modules/shared/identifiers-and-time.ts';
import { createProblemFromError } from '../../../src/server/problem-details.ts';

describe('UUIDv7 and business date validation (C-01 / ADR-0003)', () => {
  it('generates RFC 9562 UUIDv7 identifiers ordered by timestamp', () => {
    const first = generateUuidV7(1_760_000_000_000);
    const second = generateUuidV7(1_760_000_000_001);

    expect(isUuidV4OrV7(first)).toBe(true);
    expect(isUuidV4OrV7(second)).toBe(true);
    expect(first.slice(0, 13) < second.slice(0, 13)).toBe(true);
    expect(isUuidV4OrV7('not-a-uuid')).toBe(false);
    expect(isUuidV4OrV7('00000000-0000-1000-8000-000000000000')).toBe(false);
  });

  it('validates real calendar dates in YYYY-MM-DD format (VAL-03)', () => {
    expect(isValidIsoCalendarDate('2026-04-14')).toBe(true);
    expect(isValidIsoCalendarDate('2024-02-29')).toBe(true);
    expect(isValidIsoCalendarDate('2026-02-29')).toBe(false);
    expect(isValidIsoCalendarDate('2026-04-31')).toBe(false);
    expect(isValidIsoCalendarDate('2026-13-01')).toBe(false);
    expect(isValidIsoCalendarDate('14/04/2026')).toBe(false);
  });

  it('enforces startDate < endDate when endDate is provided (VAL-04)', () => {
    expect(isValidPeriod('2026-03-01', null)).toBe(true);
    expect(isValidPeriod('2026-03-01', '2026-03-02')).toBe(true);
    expect(isValidPeriod('2026-03-01', '2026-03-01')).toBe(false);
    expect(isValidPeriod('2026-03-05', '2026-03-02')).toBe(false);
  });
});

describe('RFC 9457 Problem Details mapping (C-01 / ADR-0002)', () => {
  it('maps domain and validation errors into Portuguese RFC 9457 payloads without echoing secrets', () => {
    const validationErr = validationFailedError([
      { field: 'endDate', code: 'INVALID_PERIOD', message: 'A data final deve ser posterior à data inicial.' },
    ]);
    const problem = createProblemFromError(validationErr, 'trace-123');

    expect(problem).toEqual({
      type: 'urn:erp:problem:validation-failed',
      title: 'Falha de validação',
      status: 422,
      detail: 'Um ou mais campos informados são inválidos.',
      code: 'VALIDATION_FAILED',
      traceId: 'trace-123',
      errors: [
        { field: 'endDate', code: 'INVALID_PERIOD', message: 'A data final deve ser posterior à data inicial.' },
      ],
    });

    const staleErr = new ApplicationError({
      status: 409,
      code: 'STALE_VERSION',
      detail: 'O registro foi atualizado por outra operação. Recarregue os dados antes de tentar novamente.',
    });
    expect(createProblemFromError(staleErr, 'trace-456')).toEqual({
      type: 'urn:erp:problem:conflict',
      title: 'Conflito de operação',
      status: 409,
      detail: 'O registro foi atualizado por outra operação. Recarregue os dados antes de tentar novamente.',
      code: 'STALE_VERSION',
      traceId: 'trace-456',
    });
  });
});

describe('Idempotency store (C-03 / OP-02)', () => {
  it('replays identical operations and rejects reused keys with different payloads', async () => {
    const store = new InMemoryIdempotencyStore();
    let executions = 0;

    const first = await store.execute({
      operationType: 'CREATE_PROJECT',
      actorId: '01963000-0000-7000-8000-000000000001',
      operationId: '01963000-0000-7000-8000-000000000099',
      payload: { name: 'Oficina de Música', startDate: '2026-03-01' },
      run: async () => {
        executions += 1;
        return { statusCode: 201, body: { id: 'proj-1', name: 'Oficina de Música' } };
      },
    });

    const replay = await store.execute({
      operationType: 'CREATE_PROJECT',
      actorId: '01963000-0000-7000-8000-000000000001',
      operationId: '01963000-0000-7000-8000-000000000099',
      payload: { startDate: '2026-03-01', name: 'Oficina de Música' },
      run: async () => {
        executions += 1;
        return { statusCode: 201, body: { id: 'proj-2', name: 'Oficina de Música' } };
      },
    });

    expect(executions).toBe(1);
    expect(first).toEqual({ statusCode: 201, body: { id: 'proj-1', name: 'Oficina de Música' }, replayed: false });
    expect(replay).toEqual({ statusCode: 201, body: { id: 'proj-1', name: 'Oficina de Música' }, replayed: true });

    await expect(
      store.execute({
        operationType: 'CREATE_PROJECT',
        actorId: '01963000-0000-7000-8000-000000000001',
        operationId: '01963000-0000-7000-8000-000000000099',
        payload: { name: 'Oficina Diferente', startDate: '2026-03-01' },
        run: async () => ({ statusCode: 201, body: {} }),
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: 'IDEMPOTENCY_CONFLICT',
    });
  });
});

describe('Audit trail (C-03 / RF-ACS-04 / RF-ACS-05 / VAL-10)', () => {
  it('records factDate separately from recordedAt, enforces reason on changes, and strips secret fields', async () => {
    const audit = new InMemoryAuditTrail(() => new Date('2026-04-14T18:30:00.000Z'));

    const entry = await audit.record({
      actorId: '01963000-0000-7000-8000-000000000001',
      factDate: '2026-04-10',
      entityType: 'USER',
      entityId: '01963000-0000-7000-8000-000000000002',
      action: 'UPDATE_PROFILES',
      before: { profiles: ['PERIODIC_ACTIVITY'], passwordHash: 'secret-hash' },
      after: { profiles: ['COORDINATOR'], password: 'raw-password' },
      reason: 'Designação para coordenação de projetos.',
      operationId: '01963000-0000-7000-8000-000000000055',
    });

    expect(entry.factDate).toBe('2026-04-10');
    expect(entry.recordedAt).toBe('2026-04-14T18:30:00.000Z');
    expect(entry.before).toEqual({ profiles: ['PERIODIC_ACTIVITY'] });
    expect(entry.after).toEqual({ profiles: ['COORDINATOR'] });

    await expect(
      audit.record({
        actorId: '01963000-0000-7000-8000-000000000001',
        factDate: '2026-04-10',
        entityType: 'PROJECT',
        entityId: '01963000-0000-7000-8000-000000000010',
        action: 'UPDATE',
        before: { name: 'Antigo' },
        after: { name: 'Novo' },
        reason: '   ',
      }),
    ).rejects.toMatchObject({
      status: 422,
      code: 'VALIDATION_FAILED',
    });
  });
});

