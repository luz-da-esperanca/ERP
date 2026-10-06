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
