import { describe, expect, it, vi } from 'vitest';
import { HttpProjects } from '../../../../src/projects';
import { ApiClient } from '../../../../src/shared/api-client';

const id = '00000000-0000-4000-8000-000000000001';
describe('Projects HTTP management', () => {
  it('sends closure as a dated command with revision, reason and the supplied retry key', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json(
          { error: { code: 'REVISION_CONFLICT', requestId: 'test' } },
          { status: 409 },
        ),
      );
    const gateway = new HttpProjects(new ApiClient(fetcher));
    const input = {
      expectedRevision: 3,
      effectiveAt: '2026-01-02T12:00:00.000Z',
      reason: 'Synthetic closure',
    };
    await expect(gateway.closeProject(id, input, id)).rejects.toMatchObject({
      code: 'REVISION_CONFLICT',
    });
    expect(fetcher.mock.lastCall).toEqual([
      '/api/v1/projects/' + id + '/closure',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(input),
        headers: expect.objectContaining({ 'Idempotency-Key': id }),
      }),
    ]);
  });
});
