import { describe, expect, it } from 'vitest';
import {
  AccountRevisionConflictError,
  AccountRuleError,
  PermissionDeniedError,
} from '../../../src/features/access/domain/account-errors.js';
import {
  AuthenticationRequiredError,
  LoginBlockedError,
} from '../../../src/features/access/application/access-errors.js';
import {
  DependencyUnavailableError,
  ResourceNotFoundError,
  IdempotencyConflictError,
  FeatureNotEnabledError,
} from '../../../src/core/application/errors.js';
import {
  ReportChangedError,
  ReportRuleError,
} from '../../../src/features/reports/domain/report-errors.js';
import { z } from 'zod';
import { mapError } from '../../../src/core/presentation/error-mapper.js';
import { SocialFormRevisionConflictError } from '../../../src/features/social-forms/domain/social-form-errors.js';
import {
  EligibilityConflictError,
  EligibilityRuleError,
} from '../../../src/features/eligibility/domain/eligibility-errors.js';

describe('HTTP error mapping', () => {
  it('tells a changed report apart from an invalid report filter', () => {
    expect(mapError(new ReportChangedError())).toEqual({
      status: 409,
      code: 'REPORT_CHANGED',
      message: 'Report sources changed',
    });
    expect(
      mapError(new ReportRuleError('REPORT_FILTER_CONFLICT')),
    ).toMatchObject({
      status: 422,
      code: 'BUSINESS_RULE_VIOLATION',
      details: { rule: 'REPORT_FILTER_CONFLICT' },
    });
  });
  it('distinguishes an unsupported eligibility policy from a concurrent publication', () => {
    expect(
      mapError(new EligibilityRuleError('UNSUPPORTED_POLICY_MODALITY')),
    ).toMatchObject({
      status: 422,
      code: 'BUSINESS_RULE_VIOLATION',
      details: { rule: 'UNSUPPORTED_POLICY_MODALITY' },
    });
    expect(
      mapError(new EligibilityConflictError('POLICY_CHANGED', ['policy-id'])),
    ).toMatchObject({
      status: 409,
      code: 'DOMAIN_CONFLICT',
      details: { rule: 'POLICY_CHANGED', ids: ['policy-id'] },
    });
  });
  it('reports the current social revision independently from publication identity conflicts', () => {
    expect(mapError(new SocialFormRevisionConflictError(3))).toEqual({
      status: 409,
      code: 'REVISION_CONFLICT',
      message: 'Resource revision changed',
      details: { currentRevision: 3 },
    });
  });
  it('translates a domain revision conflict into the public HTTP contract', () => {
    expect(mapError(new AccountRevisionConflictError(9))).toEqual({
      status: 409,
      code: 'REVISION_CONFLICT',
      message: 'Resource revision changed',
      details: { currentRevision: 9 },
    });
  });

  it.each([
    {
      error: new AccountRuleError('LAST_ACTIVE_ADMINISTRATOR'),
      status: 422,
      code: 'BUSINESS_RULE_VIOLATION',
      details: { rule: 'LAST_ACTIVE_ADMINISTRATOR' },
    },
    {
      error: new PermissionDeniedError('PASSWORD_CHANGE_REQUIRED'),
      status: 403,
      code: 'FORBIDDEN',
      details: { rule: 'PASSWORD_CHANGE_REQUIRED' },
    },
    {
      error: new PermissionDeniedError(),
      status: 403,
      code: 'FORBIDDEN',
      details: undefined,
    },
    {
      error: new AuthenticationRequiredError(),
      status: 401,
      code: 'UNAUTHENTICATED',
      details: undefined,
    },
    {
      error: new ResourceNotFoundError(),
      status: 404,
      code: 'NOT_FOUND',
      details: undefined,
    },
    {
      error: new DependencyUnavailableError(),
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
      details: undefined,
    },
    {
      error: new IdempotencyConflictError(),
      status: 409,
      code: 'IDEMPOTENCY_CONFLICT',
      details: undefined,
    },
    {
      error: new FeatureNotEnabledError(),
      status: 422,
      code: 'FEATURE_NOT_ENABLED',
      details: undefined,
    },
  ])(
    'maps $code without changing the semantic error',
    ({ error, status, code, details }) => {
      expect(mapError(error)).toEqual({
        status,
        code,
        message: error.message,
        ...(details ? { details } : {}),
      });
      expect(error).not.toHaveProperty('status');
    },
  );

  it('exposes the temporary login block duration through Retry-After metadata', () => {
    expect(mapError(new LoginBlockedError(900))).toEqual({
      status: 429,
      code: 'TOO_MANY_ATTEMPTS',
      message: 'Login temporarily blocked',
      retryAfter: 900,
    });
  });

  it('reports invalid input field names without exposing supplied values', () => {
    const result = z
      .object({ password: z.string().min(12) })
      .safeParse({ password: 'private' });
    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected invalid test input');

    expect(mapError(result.error)).toEqual({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid request',
      details: { fields: ['password'] },
    });
  });

  it('hides unknown errors and their sensitive metadata', () => {
    const error = Object.assign(new Error('SQL with private data'), {
      password: 'private',
      stack: 'private stack',
    });
    expect(mapError(error)).toEqual({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  });
});
