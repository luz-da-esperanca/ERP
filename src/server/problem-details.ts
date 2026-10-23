const problemDefinitions = {
  400: { type: 'invalid-request', title: 'Requisição inválida', code: 'INVALID_REQUEST' },
  404: { type: 'not-found', title: 'Recurso não encontrado', code: 'RESOURCE_NOT_FOUND' },
  500: { type: 'internal-error', title: 'Erro interno', code: 'INTERNAL_ERROR' },
  503: { type: 'service-unavailable', title: 'Serviço temporariamente indisponível', code: 'SERVICE_UNAVAILABLE' },
} as const;

export function createProblem(status: keyof typeof problemDefinitions, traceId: string) {
  const problem = problemDefinitions[status];
  return { ...problem, type: `urn:erp:problem:${problem.type}`, status, traceId };
}
