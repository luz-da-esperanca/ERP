import { validationFailedError } from './errors.ts';

export function requireChangeReason(value: unknown): string {
  const reason = typeof value === 'string' ? value.trim() : '';
  if (reason.length === 0 || reason.length > 1000) {
    throw validationFailedError([{ field: 'reason', code: reason.length === 0 ? 'REQUIRED_FIELD' : 'INVALID_LENGTH',
      message: 'A justificativa é obrigatória e deve ter no máximo 1000 caracteres.' }]);
  }
  return reason;
}
