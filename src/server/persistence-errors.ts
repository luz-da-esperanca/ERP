import { Prisma } from './generated/prisma/client.ts';
import { ApplicationError, duplicateResourceError } from '../modules/shared/errors.ts';

const UNAVAILABLE_CODES = new Set(['P1000', 'P1001', 'P1002', 'P1008', 'P1017', 'P2024', 'P2037']);

export function translatePersistenceError(error: unknown): ApplicationError | undefined {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return duplicateResourceError('Já existe um registro com estes dados únicos.');
    if (!UNAVAILABLE_CODES.has(error.code)) return undefined;
  } else if (!(error instanceof Prisma.PrismaClientInitializationError)) {
    return undefined;
  }
  return new ApplicationError({ status: 503, code: 'SERVICE_UNAVAILABLE',
    detail: 'O serviço está temporariamente indisponível. Tente novamente mais tarde.' });
}
