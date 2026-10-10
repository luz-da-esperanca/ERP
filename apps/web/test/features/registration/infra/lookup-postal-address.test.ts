import { expect, it, vi } from 'vitest';
import { lookupPostalAddress } from '../../../../src/registration';

it('looks up only a complete postal code and validates the returned address', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json({
      cep: '64000-000',
      logradouro: 'Rua Sintética',
      bairro: 'Centro',
      localidade: 'Teresina',
      uf: 'PI',
    }),
  );
  const signal = new AbortController().signal;
  await expect(lookupPostalAddress('64000', signal, fetcher)).rejects.toThrow(
    'Invalid postal code',
  );
  expect(fetcher).not.toHaveBeenCalled();
  await expect(
    lookupPostalAddress('64000-000', signal, fetcher),
  ).resolves.toEqual({
    street: 'Rua Sintética',
    neighborhood: 'Centro',
    city: 'Teresina',
    state: 'PI',
  });
  expect(fetcher).toHaveBeenCalledWith(
    'https://viacep.com.br/ws/64000000/json/',
    expect.objectContaining({
      credentials: 'omit',
      signal: expect.any(AbortSignal),
    }),
  );
});

it('distinguishes an unknown postal code from unavailable or malformed responses', async () => {
  const signal = new AbortController().signal;
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ erro: true }));
  await expect(
    lookupPostalAddress('99999999', signal, fetcher),
  ).resolves.toBeNull();
  fetcher.mockResolvedValue(new Response('', { status: 503 }));
  await expect(
    lookupPostalAddress('64000000', signal, fetcher),
  ).rejects.toThrow('Postal address service unavailable');
  fetcher.mockResolvedValue(Response.json({ logradouro: 'Invalid response' }));
  await expect(
    lookupPostalAddress('64000000', signal, fetcher),
  ).rejects.toThrow('Invalid postal address response');
  fetcher.mockResolvedValue(
    Response.json({
      cep: '64001-000',
      logradouro: '',
      bairro: '',
      localidade: 'Teresina',
      uf: 'PI',
    }),
  );
  await expect(
    lookupPostalAddress('64000000', signal, fetcher),
  ).rejects.toThrow('Postal address response mismatch');
});
