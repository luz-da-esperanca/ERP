import type { Cpf } from '@erp/contracts/cpf';
import type { DuplicateRecord } from './duplicate-rules.js';
import { RegistrationConflictError } from './registration-errors.js';

export function assertCpfAvailable(
  cpf: Cpf | null,
  records: readonly DuplicateRecord[],
  currentPersonId?: string,
) {
  if (!cpf) return;
  const duplicates = records.filter(
    (record) => record.id !== currentPersonId && record.cpf === cpf.value,
  );
  if (duplicates.length)
    throw new RegistrationConflictError(
      'CPF_ALREADY_REGISTERED',
      duplicates.map((record) => record.id),
    );
}
