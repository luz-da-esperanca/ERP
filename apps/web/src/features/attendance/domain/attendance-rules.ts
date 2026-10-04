import type { ActivitySession } from '@erp/contracts/attendance';
import { ApplicationError } from '@erp/contracts/common';
export function validateCorrection(
  session: ActivitySession,
  personIds: readonly string[],
) {
  if (session.status === 'CANCELED')
    throw new ApplicationError(
      'DOMAIN_CONFLICT',
      'Canceled sessions cannot be changed',
    );
  if (new Set(personIds).size !== personIds.length)
    throw new ApplicationError(
      'DOMAIN_CONFLICT',
      'A person can only be marked once per session',
    );
}
