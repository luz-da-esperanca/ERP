import { StockApiError, type FieldValidationIssue, type StockApiErrorCode } from './stock-api.ts';

const KNOWN_CODES: readonly StockApiErrorCode[] = [
  'INVALID_REQUEST',
  'AUTH_REQUIRED',
  'INVALID_CREDENTIALS',
  'CSRF_REJECTED',
  'FORBIDDEN',
  'RESOURCE_NOT_FOUND',
  'CONFLICT',
  'STALE_VERSION',
  'IDEMPOTENCY_CONFLICT',
  'DUPLICATE_RESOURCE',
  'VALIDATION_FAILED',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toKnownCode(value: unknown): StockApiErrorCode | null {
  if (typeof value !== 'string') return null;
  return KNOWN_CODES.find((code) => code === value) ?? null;
}

function toFieldIssue(value: unknown): FieldValidationIssue | null {
  if (!isRecord(value)) return null;
  const { field, code, message } = value;
  if (typeof field !== 'string' || typeof code !== 'string' || typeof message !== 'string') return null;
  return { field, code, message };
}

/**
 * Maps an unknown failure body to a typed client error. Bodies outside the
 * published problem contract become UNEXPECTED_RESPONSE instead of throwing
 * during parsing.
 */
export function toStockApiError(status: number, body: unknown): StockApiError {
  if (!isRecord(body)) {
    return new StockApiError({ status, code: 'UNEXPECTED_RESPONSE', traceId: null, errors: [] });
  }
  const code = toKnownCode(body.code);
  if (code === null) {
    return new StockApiError({ status, code: 'UNEXPECTED_RESPONSE', traceId: null, errors: [] });
  }
  const errors = Array.isArray(body.errors)
    ? body.errors.map(toFieldIssue).filter((issue): issue is FieldValidationIssue => issue !== null)
    : [];
  return new StockApiError({
    status,
    code,
    traceId: typeof body.traceId === 'string' ? body.traceId : null,
    errors,
  });
}

export async function readStockApiError(response: Response): Promise<StockApiError> {
  return toStockApiError(response.status, await readJson(response));
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
