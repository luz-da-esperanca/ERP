import { invalidRequestError, validationFailedError } from '../errors.ts';
import { isUuidV4OrV7, validateFactDate } from '../identifiers-and-time.ts';
import type { Pagination } from '../pagination.ts';

export function readJsonBody(body: unknown, allowedFields: readonly string[]): Record<string, unknown> {
  if (!isObjectRecord(body)) throw invalidRequestError('O corpo da requisição deve ser um objeto JSON válido.');
  if (Object.keys(body).some((key) => !allowedFields.includes(key))) {
    throw invalidRequestError('A requisição contém campos não permitidos.');
  }
  return body;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function readQuery(value: unknown, allowedFields: readonly string[]): Record<string, unknown> {
  const query = value ?? {};
  if (!isObjectRecord(query) || Object.keys(query).some((key) => !allowedFields.includes(key))) {
    throw invalidRequestError('Os parâmetros de consulta informados são inválidos.');
  }
  return query;
}

export function readEnumFilter<Value extends string>(value: unknown, allowedValues: readonly Value[]): Value | undefined {
  if (value === undefined) return undefined;
  const matching = allowedValues.find((allowed) => allowed === value);
  if (matching === undefined) throw invalidRequestError('Um filtro informado não é reconhecido.');
  return matching;
}

export function readStringFilter(value: unknown, maxLength: number): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > maxLength) throw invalidRequestError('Um filtro informado possui tipo ou tamanho inválido.');
  return value.trim() || undefined;
}

export function readIdentifierFilter(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (!isUuidV4OrV7(value)) throw invalidRequestError('O filtro de identificação deve ser um UUID válido.');
  return value.toLowerCase();
}

export function readRouteIdentifier(params: unknown): string {
  return isObjectRecord(params) && typeof params.id === 'string' ? params.id.toLowerCase() : '';
}

export function readFactDate(body: Record<string, unknown>): string | undefined {
  const value = body.factDate;
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw validationFailedError([{ field: 'factDate', code: 'INVALID_FORMAT', message: 'A data do fato deve ser uma data válida no formato AAAA-MM-DD.' }]);
  }
  validateFactDate(value);
  return value;
}

export function readPagination(query: Record<string, unknown>): Pagination {
  const page = readInteger(query.page, 1);
  const pageSize = readInteger(query.pageSize, 20);
  if (pageSize > 100 || !Number.isSafeInteger((page - 1) * pageSize)) {
    throw invalidRequestError('A paginação informada é inválida; pageSize deve ser no máximo 100.');
  }
  return { page, pageSize };
}

function readInteger(value: unknown, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) {
    throw invalidRequestError('Os parâmetros de paginação devem ser números inteiros positivos.');
  }
  return Number(value);
}
