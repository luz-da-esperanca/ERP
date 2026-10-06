import { useState } from 'react';
import { ApplicationError } from '@erp/contracts/common';
import { ApiRequestError } from './api-client';
import { ZodError } from 'zod';
export function errorMessage(error: unknown): string {
  if (error instanceof ZodError)
    return 'Revise os campos informados. Verifique formatos, limites e dados obrigatórios.';
  if (error instanceof ApplicationError || error instanceof ApiRequestError) {
    if (error instanceof ApiRequestError && error.status === 401)
      return 'Sua sessão terminou. Entre novamente.';
    if (
      error instanceof ApiRequestError &&
      error.status === 409 &&
      error.code === 'DOMAIN_CONFLICT'
    )
      return 'A operação conflita com registros existentes. Refaça a prévia e revise os conflitos antes de confirmar.';
    const messages = {
      UNAUTHENTICATED: 'Sua sessão terminou. Entre novamente na demonstração.',
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
        'Esta operação ainda não está disponível nesta demonstração.',
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
    };
    if (error.code in messages)
      return messages[error.code as keyof typeof messages];
  }
  return 'Não foi possível concluir a operação. Tente novamente.';
}
export function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(action: () => Promise<unknown>) {
    setPending(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    } finally {
      setPending(false);
    }
  }
  return { pending, error, run };
}
