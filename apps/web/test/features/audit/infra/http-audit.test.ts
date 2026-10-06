import { describe, expect, it, vi } from 'vitest';
import { HttpAudit } from '../../../../src/audit';
import { ApiClient } from '../../../../src/shared/api-client';
import { auditDescription } from '../../../../src/shared/audit';

describe('HTTP family audit', () => {
  it.each(['CREATE', 'MERGE'])(
    'requests the authorized family history and preserves author, fact date and reason for %s',
    async (action) => {
      const id = '00000000-0000-4000-8000-000000000001';
      const at = '2026-10-01T12:00:00.000Z';
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          data: [
            {
              id,
              operationId: id,
              entityType: 'Family',
              entityId: id,
              revision: 1,
              action,
              actorType: 'USER',
              actorId: id,
              actor: { id, displayName: 'Synthetic operator', active: false },
              recordedAt: at,
              occurredAt: '2026-09-01T12:00:00.000Z',
              before: null,
              after: {
                id,
                code: '1',
                referenceName: null,
                address: null,
                neighborhood: null,
                postalCode: null,
                location: null,
                contactPhone: null,
                revision: 1,
                createdAt: at,
                updatedAt: at,
              },
              reason: 'Synthetic reason',
              classification: 'REGISTRATION',
            },
          ],
          pagination: { page: 1, pageSize: 100, total: 1 },
        }),
      );
      const entries = await new HttpAudit(new ApiClient(fetcher)).list(id);
      const url = new URL(
        String(fetcher.mock.lastCall?.[0]),
        'http://localhost',
      );
      expect(url.searchParams.get('entityType')).toBe('Family');
      expect(url.searchParams.get('entityId')).toBe(id);
      expect(entries[0]).toMatchObject({
        actorName: 'Synthetic operator',
        entityLabel: 'Família 1',
        reason: 'Synthetic reason',
        occurredAt: '2026-09-01T12:00:00.000Z',
      });
      expect(auditDescription(entries[0]!)).toBe(
        action === 'MERGE'
          ? 'Cadastros unificados — Família 1'
          : 'Cadastro criado — Família 1',
      );
    },
  );
});
it('queries a selected authorized audit entity using public filters and preserves pagination', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json({
      data: [],
      pagination: { page: 2, pageSize: 20, total: 21 },
    }),
  );
  const audit = new HttpAudit(new ApiClient(fetcher));
  const result = await audit.query({ entityType: 'UserAccount', page: 2 });
  expect(result.pagination.total).toBe(21);
  expect(fetcher.mock.lastCall?.[0]).toContain('entityType=UserAccount');
  expect(fetcher.mock.lastCall?.[0]).toContain('page=2');
});
