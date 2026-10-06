import { ZodError } from 'zod';
import { ApiRequestError } from '../../../shared/api-client';

export function authenticationError(
  error: unknown,
  operation?: 'login',
): string {
  if (error instanceof ZodError)
    return 'Confira os campos. A senha deve ter pelo menos 12 caracteres e até 72 bytes.';
  if (error instanceof ApiRequestError) {
    if (error.status === 401)
      return operation === 'login'
        ? 'Login ou senha inválidos.'
        : 'Sua sessão expirou. Entre novamente.';
    if (error.code === 'TOO_MANY_ATTEMPTS')
      return error.retryAfterSeconds === null
        ? 'Muitas tentativas. Aguarde antes de tentar novamente.'
        : `Muitas tentativas. Tente novamente em ${error.retryAfterSeconds} segundos.`;
    if (error.code === 'REVISION_CONFLICT')
      return 'A conta foi alterada durante a operação. Entre novamente para conferir a versão atual antes de tentar outra vez.';
    if (
      error.code === 'DEPENDENCY_UNAVAILABLE' ||
      error.code === 'NETWORK_ERROR'
    )
      return 'Não foi possível conectar ao serviço de acesso. Tente novamente.';
  }
  return 'Não foi possível concluir a operação. Tente novamente.';
}
