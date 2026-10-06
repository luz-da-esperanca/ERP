import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiClient, ApiRequestError } from '../../src/shared/api-client';

describe('Browser API transport', () => {
  it('notifies session expiry on any unauthorized API response, including a malformed body', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('Unavailable details', { status: 401 }));
    const client = new ApiClient(fetcher);
    const listener = vi.fn();
    const unsubscribe = client.subscribeUnauthorized(listener);
    await expect(
      client.request('/records', z.object({ data: z.string() })),
    ).rejects.toMatchObject({ status: 401 });
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
    await expect(
      client.request('/records', z.object({ data: z.string() })),
    ).rejects.toMatchObject({ status: 401 });
    expect(listener).toHaveBeenCalledOnce();
  });
  it('accepts the empty logout response without attempting JSON decoding', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    const client = new ApiClient(fetcher);
    await expect(
      client.requestEmpty('/auth/logout', { method: 'POST', body: {} }),
    ).resolves.toBeUndefined();
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
      body: '{}',
    });
    fetcher.mockResolvedValue(Response.json({ data: 'unexpected' }));
    await expect(
      client.requestEmpty('/auth/logout', { method: 'POST', body: {} }),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('fails closed on malformed success bodies and converts network failures to safe errors', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: { private: 'untrusted' } }));
    const client = new ApiClient(fetcher);
    await expect(
      client.request('/records', z.object({ data: z.string() })),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 200 });
    fetcher.mockResolvedValue(
      new Response('private upstream details', { status: 503 }),
    );
    await expect(
      client.request('/records', z.object({ data: z.string() })),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 503 });
    fetcher.mockRejectedValue(new Error('Private transport error'));
    await expect(
      client.request('/records', z.object({ data: z.string() })),
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0 });
  });
  it('keeps failure metadata and retry time without exposing a technical server message', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(
        {
          error: {
            code: 'TOO_MANY_ATTEMPTS',
            message: 'Private technical details',
            requestId: 'request-id',
            details: { rule: 'LOGIN_BLOCKED' },
          },
        },
        { status: 429, headers: { 'Retry-After': '30' } },
      ),
    );
    const client = new ApiClient(fetcher);
    const error = await client
      .request('/auth/login', z.object({ data: z.string() }), {
        method: 'POST',
        body: { password: 'Synthetic secret' },
      })
      .catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({
      code: 'TOO_MANY_ATTEMPTS',
      status: 429,
      requestId: 'request-id',
      details: { rule: 'LOGIN_BLOCKED' },
      retryAfterSeconds: 30,
    });
    expect((error as Error).message).not.toContain('Private');
    expect(JSON.stringify(error)).not.toContain('Synthetic secret');
  });
  it('sends same-origin JSON writes with cookies and validates the public response', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: { id: 'record' } }));
    const client = new ApiClient(fetcher);
    const schema = z
      .object({ data: z.object({ id: z.string() }).strict() })
      .strict();
    expect(
      await client.request('/records', schema, {
        method: 'POST',
        body: { value: 0 },
        idempotencyKey: '00000000-0000-4000-8000-000000000001',
      }),
    ).toEqual({ data: { id: 'record' } });
    expect(fetcher).toHaveBeenCalledWith('/api/v1/records', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'X-ERP-Request': '1',
        'Idempotency-Key': '00000000-0000-4000-8000-000000000001',
      },
      body: '{"value":0}',
    });
  });
});
