import type {
  ApplicationError,
  FieldValidationError,
  ProblemCode,
  ProblemStatus,
} from '../modules/shared/errors.ts';

const problemDefinitions = {
  400: { type: 'invalid-request', title: 'Requisição inválida', code: 'INVALID_REQUEST' },
  401: { type: 'unauthorized', title: 'Não autenticado', code: 'AUTH_REQUIRED' },
  403: { type: 'forbidden', title: 'Acesso negado', code: 'FORBIDDEN' },
  404: { type: 'not-found', title: 'Recurso não encontrado', code: 'RESOURCE_NOT_FOUND' },
  409: { type: 'conflict', title: 'Conflito de operação', code: 'CONFLICT' },
  422: { type: 'validation-failed', title: 'Falha de validação', code: 'VALIDATION_FAILED' },
  429: { type: 'rate-limited', title: 'Limite de tentativas excedido', code: 'RATE_LIMITED' },
  500: { type: 'internal-error', title: 'Erro interno', code: 'INTERNAL_ERROR' },
  503: { type: 'service-unavailable', title: 'Serviço temporariamente indisponível', code: 'SERVICE_UNAVAILABLE' },
} as const satisfies Record<ProblemStatus, { type: string; title: string; code: ProblemCode }>;

export interface ProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: ProblemStatus;
  readonly detail?: string;
  readonly code: ProblemCode;
  readonly traceId: string;
  readonly errors?: readonly FieldValidationError[];
}

export function createProblem(status: keyof typeof problemDefinitions, traceId: string): ProblemDetails {
  const problem = problemDefinitions[status];
  return { ...problem, type: `urn:erp:problem:${problem.type}`, status, traceId };
}

export function createProblemFromError(error: ApplicationError, traceId: string): ProblemDetails {
  const base = problemDefinitions[error.status];
  return {
    type: `urn:erp:problem:${base.type}`,
    title: base.title,
    status: error.status,
    detail: error.detail,
    code: error.code,
    traceId,
    ...(error.errors ? { errors: error.errors } : {}),
  };
}
