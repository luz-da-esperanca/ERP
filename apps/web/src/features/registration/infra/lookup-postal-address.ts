import { z } from 'zod';

const postalAddressSchema = z.object({
  cep: z.string().regex(/^\d{5}-\d{3}$/),
  logradouro: z.string().trim().max(300),
  bairro: z.string().trim().max(200),
  localidade: z.string().trim().min(1).max(100),
  uf: z.string().regex(/^[A-Z]{2}$/),
});
const postalResponseSchema = z.union([
  z.object({ erro: z.literal(true) }),
  postalAddressSchema,
]);

export async function lookupPostalAddress(
  input: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
) {
  const postalCode = input.replace('-', '');
  if (!/^\d{8}$/.test(postalCode)) throw new Error('Invalid postal code');
  const response = await fetcher(
    `https://viacep.com.br/ws/${postalCode}/json/`,
    {
      signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: { Accept: 'application/json' },
    },
  );
  if (!response.ok) throw new Error('Postal address service unavailable');
  const result = postalResponseSchema.safeParse(await response.json());
  if (!result.success) throw new Error('Invalid postal address response');
  const address = result.data;
  if ('erro' in address) return null;
  if (address.cep.replace('-', '') !== postalCode)
    throw new Error('Postal address response mismatch');
  return {
    street: address.logradouro,
    neighborhood: address.bairro,
    city: address.localidade,
    state: address.uf,
  };
}
