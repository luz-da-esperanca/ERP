import { z } from 'zod';

export const idSchema = z.uuid();
export const nameSchema = z.string().trim().min(1).max(200);
export const reasonSchema = z.string().trim().min(1).max(1000);
export const revisionSchema = z.number().int().positive();
export const civilDateSchema = z.iso.date();
export const instantSchema = z.iso.datetime({ offset: true });
export const optionalText = (max: number) =>
  z.preprocess(
    (value) => (value === '' || value === undefined ? null : value),
    z.string().trim().max(max).nullable(),
  );
export const optionalDateSchema = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  civilDateSchema.nullable(),
);
export const optionalMoneySchema = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z
    .string()
    .regex(/^\d{1,12}(\.\d{1,2})?$/)
    .nullable(),
);
export type Id = string;
export type Revision = number;
export type CivilDate = string;
export type Instant = string;
export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'REVISION_CONFLICT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'DOMAIN_CONFLICT'
  | 'REPORT_CHANGED'
  | 'VALIDATION_ERROR'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'BUSINESS_RULE_VIOLATION'
  | 'FEATURE_NOT_ENABLED'
  | 'TOO_MANY_ATTEMPTS'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'INTERNAL_ERROR';
export class ApplicationError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}
