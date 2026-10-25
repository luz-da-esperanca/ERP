export type ProblemStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 503;

export type ProblemCode =
  | 'INVALID_REQUEST'
  | 'AUTH_REQUIRED'
  | 'INVALID_CREDENTIALS'
  | 'CSRF_REJECTED'
  | 'FORBIDDEN'
  | 'RESOURCE_NOT_FOUND'
  | 'CONFLICT'
  | 'STALE_VERSION'
  | 'IDEMPOTENCY_CONFLICT'
  | 'DUPLICATE_RESOURCE'
  | 'VALIDATION_FAILED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';

export interface FieldValidationError {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

export interface ApplicationErrorOptions {
  readonly status: ProblemStatus;
  readonly code: ProblemCode;
  readonly detail: string;
  readonly errors?: readonly FieldValidationError[];
  readonly retryAfterSeconds?: number;
}

export class ApplicationError extends Error {
  readonly status: ProblemStatus;
  readonly code: ProblemCode;
  readonly detail: string;
  readonly errors?: readonly FieldValidationError[];
  readonly retryAfterSeconds?: number;

  constructor(options: ApplicationErrorOptions) {
    super(options.detail);
    this.name = 'ApplicationError';
    this.status = options.status;
    this.code = options.code;
    this.detail = options.detail;
    if (options.errors !== undefined) {
      this.errors = options.errors;
    }
    if (options.retryAfterSeconds !== undefined) {
      this.retryAfterSeconds = options.retryAfterSeconds;
    }
  }
}

export function validationFailedError(
  errors: readonly FieldValidationError[],
  detail = 'Um ou mais campos informados são inválidos.',
): ApplicationError {
  return new ApplicationError({
    status: 422,
    code: 'VALIDATION_FAILED',
    detail,
    errors,
  });
}

export function invalidRequestError(
  detail = 'A requisição enviada é inválida ou incompleta.',
): ApplicationError {
  return new ApplicationError({
    status: 400,
    code: 'INVALID_REQUEST',
    detail,
  });
}

export function authRequiredError(
  detail = 'Sua sessão expirou ou não foi informada. Faça login novamente.',
): ApplicationError {
  return new ApplicationError({
    status: 401,
    code: 'AUTH_REQUIRED',
    detail,
  });
}

export function invalidCredentialsError(
  detail = 'Credenciais inválidas. Verifique seu identificador e senha.',
): ApplicationError {
  return new ApplicationError({
    status: 401,
    code: 'INVALID_CREDENTIALS',
    detail,
  });
}

export function forbiddenError(
  detail = 'Seu perfil não possui permissão para executar esta operação.',
): ApplicationError {
  return new ApplicationError({
    status: 403,
    code: 'FORBIDDEN',
    detail,
  });
}

export function csrfRejectedError(
  detail = 'A verificação de segurança da solicitação falhou.',
): ApplicationError {
  return new ApplicationError({
    status: 403,
    code: 'CSRF_REJECTED',
    detail,
  });
}

export function resourceNotFoundError(
  detail = 'O recurso solicitado não foi encontrado.',
): ApplicationError {
  return new ApplicationError({
    status: 404,
    code: 'RESOURCE_NOT_FOUND',
    detail,
  });
}

export function staleVersionError(
  detail = 'O registro foi atualizado por outra operação. Recarregue os dados antes de tentar novamente.',
): ApplicationError {
  return new ApplicationError({
    status: 409,
    code: 'STALE_VERSION',
    detail,
  });
}

export function duplicateResourceError(detail: string): ApplicationError {
  return new ApplicationError({
    status: 409,
    code: 'DUPLICATE_RESOURCE',
    detail,
  });
}

export function idempotencyConflictError(
  detail = 'A chave de idempotência informada já foi utilizada com dados diferentes.',
): ApplicationError {
  return new ApplicationError({
    status: 409,
    code: 'IDEMPOTENCY_CONFLICT',
    detail,
  });
}

export function rateLimitedError(
  retryAfterSeconds: number,
  detail = 'Muitas tentativas seguidas. Aguarde antes de tentar novamente.',
): ApplicationError {
  return new ApplicationError({
    status: 429,
    code: 'RATE_LIMITED',
    detail,
    retryAfterSeconds,
  });
}
