import { useState } from 'react';
import { ApplicationError } from '@erp/contracts/common';
import { ZodError } from 'zod';
import { ApiRequestError } from './api-client';
export function errorMessage(error: unknown): string {
  if (
    error instanceof ZodError &&
    error.issues.some((issue) => issue.path.includes('cpf'))
  )
    return 'CPF inválido. Confira os 11 dígitos informados.';
  if (error instanceof ZodError)
    return 'Revise os campos informados. Verifique formatos, limites e dados obrigatórios.';
  if (error instanceof ApplicationError || error instanceof ApiRequestError) {
    if (
      error instanceof ApiRequestError &&
      error.code === 'DOMAIN_CONFLICT' &&
      error.details &&
      typeof error.details === 'object' &&
      'rule' in error.details &&
      error.details.rule === 'CPF_ALREADY_REGISTERED'
    )
      return 'Este CPF já está cadastrado. Localize a pessoa existente para continuar.';
    if (error instanceof ApiRequestError && error.status === 401)
      return 'Sua sessão terminou. Entre novamente.';
    if (
      error instanceof ApiRequestError &&
      error.status === 409 &&
      error.code === 'DOMAIN_CONFLICT'
    )
      return 'A operação conflita com registros existentes. Refaça a prévia e revise os conflitos antes de confirmar.';
    const messages: Record<string, string> = {
      UNAUTHENTICATED: 'Sua sessão terminou. Entre novamente.',
      FORBIDDEN: 'Seu perfil não permite esta operação.',
      NOT_FOUND:
        'O registro não está disponível. Verifique a seleção e tente novamente.',
      REVISION_CONFLICT:
        'Os dados mudaram desde a consulta. Atualize a página e revise os valores antes de confirmar.',
      DOMAIN_CONFLICT:
        'A operação conflita com registros existentes. Revise vínculos, duplicidades, datas e perfis antes de confirmar.',
      VALIDATION_ERROR:
        'Revise os valores e as datas. Fatos realizados não podem estar no futuro.',
      FEATURE_NOT_ENABLED:
        'Esta operação depende de uma configuração autorizada. Consulte a coordenação.',
      IDEMPOTENCY_CONFLICT:
        'Esta solicitação já foi usada com outros dados. Revise a operação antes de repetir.',
      REPORT_CHANGED:
        'Os registros do relatório mudaram. Consulte os totais novamente.',
      UNSUPPORTED_MEDIA_TYPE:
        'Não foi possível enviar os dados no formato esperado.',
      BUSINESS_RULE_VIOLATION:
        'Esta operação viola uma regra do sistema. Revise os dados e o estado do registro.',
      TOO_MANY_ATTEMPTS:
        'Muitas tentativas. Aguarde antes de tentar novamente.',
      DEPENDENCY_UNAVAILABLE:
        'O serviço está temporariamente indisponível. Tente novamente mais tarde.',
      INTERNAL_ERROR: 'Não foi possível concluir a operação. Tente novamente.',
      NETWORK_ERROR:
        'Não foi possível confirmar a operação por falha de conexão. Tente novamente com os mesmos dados.',
      INVALID_RESPONSE:
        'Não foi possível validar a resposta do serviço. Tente novamente.',
    };
    return messages[error.code] ?? messages.INTERNAL_ERROR!;
  }
  return 'Não foi possível concluir a operação. Tente novamente.';
}
export function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cause, setCause] = useState<unknown>(null);
  async function run(action: () => Promise<unknown>) {
    setPending(true);
    setError(null);
    setCause(null);
    try {
      await action();
      return true;
    } catch (cause) {
      setCause(cause);
      setError(errorMessage(cause));
      return false;
    } finally {
      setPending(false);
    }
  }
  return { pending, error, cause, run };
}
