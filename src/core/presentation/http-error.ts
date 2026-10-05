import type { ErrorCode } from '@erp/contracts/common';

export class HttpError extends Error {
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

export interface HttpFailure {
  status: number;
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  retryAfter?: number;
}
