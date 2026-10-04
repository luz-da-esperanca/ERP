import type { ErrorCode } from '@erp/contracts/common';
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
    readonly retryAfter?: number,
  ) {
    super(message);
  }
}
export const unauthenticated = () =>
  new ApiError(401, 'UNAUTHENTICATED', 'Authentication required');
export const forbidden = (rule?: string) =>
  new ApiError(
    403,
    'FORBIDDEN',
    'Operation not permitted',
    rule ? { rule } : undefined,
  );
export const notFound = () =>
  new ApiError(404, 'NOT_FOUND', 'Resource not found');
export const dependencyUnavailable = () =>
  new ApiError(
    503,
    'DEPENDENCY_UNAVAILABLE',
    'Required dependency unavailable',
  );
export const revisionConflict = (revision: number) =>
  new ApiError(409, 'REVISION_CONFLICT', 'Resource revision changed', {
    currentRevision: revision,
  });
export const businessRule = (rule: string) =>
  new ApiError(
    422,
    'BUSINESS_RULE_VIOLATION',
    'Operation violates a business rule',
    { rule },
  );
export const idempotencyConflict = () =>
  new ApiError(
    409,
    'IDEMPOTENCY_CONFLICT',
    'Idempotency key was used with different content or author',
  );
