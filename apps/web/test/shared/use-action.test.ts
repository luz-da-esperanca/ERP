import { expect, it } from 'vitest';
import { errorMessage } from '../../src/shared/use-action';
import { ApiRequestError } from '../../src/shared/api-client';
import { updatePersonSchema } from '@erp/contracts/registration-api';

it('explains that an existing CPF cannot be registered again', () => {
  const error = new ApiRequestError('DOMAIN_CONFLICT', 409, undefined, {
    rule: 'CPF_ALREADY_REGISTERED',
  });
  expect(errorMessage(error)).toBe(
    'Este CPF já está cadastrado. Localize a pessoa existente para continuar.',
  );
});

it('identifies an invalid CPF without displaying its supplied value', () => {
  const result = updatePersonSchema.safeParse({
    expectedRevision: 1,
    cpf: '11111111111',
  });
  if (result.success) throw new Error('Expected invalid CPF');
  expect(errorMessage(result.error)).toBe(
    'CPF inválido. Confira os 11 dígitos informados.',
  );
});
