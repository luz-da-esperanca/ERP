import { describe, expect, it, vi } from 'vitest';
import { HttpAttendance } from '../../../../src/attendance';
import { ApiClient } from '../../../../src/shared/api-client';

const id = '00000000-0000-4000-8000-000000000001';
describe('Attendance HTTP', () => {
  it('sends a partial confirmation with the server fingerprint and the supplied retry key', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json(
          { error: { code: 'REVISION_CONFLICT', requestId: 'test' } },
          { status: 409 },
        ),
      );
    const gateway = new HttpAttendance(new ApiClient(fetcher));
    const input = {
      occurredAt: '2026-01-02T12:00:00.000Z',
      responsibleId: id,
      expectedActivityRevision: 3,
      expectedRosterFingerprint: 'a'.repeat(64),
      guestPersonIds: [id],
      entries: [],
    };
    await expect(gateway.create(id, input, id)).rejects.toMatchObject({
      code: 'REVISION_CONFLICT',
    });
    expect(fetcher.mock.lastCall).toEqual([
      '/api/v1/activities/' + id + '/sessions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(input),
        headers: expect.objectContaining({ 'Idempotency-Key': id }),
      }),
    ]);
  });
});
it('declares coverage with the exact queried source fingerprint, revision and explicit confirmation', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      Response.json(
        { error: { code: 'REVISION_CONFLICT', requestId: 'coverage' } },
        { status: 409 },
      ),
    );
  const gateway = new HttpAttendance(new ApiClient(fetcher));
  const input = {
    periodStart: '2026-09-01',
    periodEndExclusive: '2026-10-05',
    expectedActivityRevision: 3,
    expectedSourceFingerprint: 'a'.repeat(64),
    confirmed: true as const,
    reason: 'Synthetic coverage confirmation',
  };
  await expect(gateway.declareCoverage(id, input, id)).rejects.toMatchObject({
    code: 'REVISION_CONFLICT',
  });
  expect(fetcher.mock.lastCall?.[1]).toMatchObject({
    method: 'POST',
    body: JSON.stringify(input),
    headers: { 'Idempotency-Key': id },
  });
});
it('corrects session metadata through PATCH without replacing the captured revisions or roster fingerprint', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      Response.json(
        { error: { code: 'REVISION_CONFLICT', requestId: 'session' } },
        { status: 409 },
      ),
    );
  const gateway = new HttpAttendance(new ApiClient(fetcher));
  const input = {
    expectedSessionRevision: 4,
    responsibleId: id,
    reason: 'Synthetic correction',
  };
  await expect(gateway.correctSession(id, input, id)).rejects.toMatchObject({
    code: 'REVISION_CONFLICT',
  });
  expect(fetcher.mock.lastCall?.[1]).toMatchObject({
    method: 'PATCH',
    body: JSON.stringify(input),
  });
});
