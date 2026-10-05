import { z } from 'zod';
import {
  AccountRevisionConflictError,
  AccountRuleError,
  PermissionDeniedError,
} from '../../features/access/domain/account-errors.js';
import {
  AuthenticationRequiredError,
  LoginBlockedError,
} from '../../features/access/application/access-errors.js';
import {
  DependencyUnavailableError,
  ResourceNotFoundError,
  IdempotencyConflictError,
  FeatureNotEnabledError,
} from '../application/errors.js';
import { HttpError } from './http-error.js';
import type { HttpFailure } from './http-error.js';

export function mapError(error: unknown): HttpFailure {
  if (error instanceof HttpError)
    return {
      status: error.status,
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
      ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}),
    };
  if (error instanceof AccountRevisionConflictError)
    return {
      status: 409,
      code: 'REVISION_CONFLICT',
      message: error.message,
      details: { currentRevision: error.currentRevision },
    };
  if (error instanceof AccountRuleError)
    return {
      status: 422,
      code: 'BUSINESS_RULE_VIOLATION',
      message: error.message,
      details: { rule: error.rule },
    };
  if (error instanceof PermissionDeniedError)
    return {
      status: 403,
      code: 'FORBIDDEN',
      message: error.message,
      ...(error.rule ? { details: { rule: error.rule } } : {}),
    };
  if (error instanceof AuthenticationRequiredError)
    return { status: 401, code: 'UNAUTHENTICATED', message: error.message };
  if (error instanceof ResourceNotFoundError)
    return { status: 404, code: 'NOT_FOUND', message: error.message };
  if (error instanceof DependencyUnavailableError)
    return {
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
      message: error.message,
    };
  if (error instanceof IdempotencyConflictError)
    return {
      status: 409,
      code: 'IDEMPOTENCY_CONFLICT',
      message: error.message,
    };
  if (error instanceof FeatureNotEnabledError)
    return { status: 422, code: 'FEATURE_NOT_ENABLED', message: error.message };
  if (error instanceof LoginBlockedError)
    return {
      status: 429,
      code: 'TOO_MANY_ATTEMPTS',
      message: error.message,
      retryAfter: error.retryAfterSeconds,
    };
  if (error instanceof z.ZodError)
    return {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid request',
      details: {
        fields: [
          ...new Set(error.issues.map((issue) => issue.path.join('.'))),
        ].filter(Boolean),
      },
    };
  if (
    error instanceof Error &&
    'statusCode' in error &&
    error.statusCode === 400
  )
    return {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid JSON request',
    };
  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
  };
}
