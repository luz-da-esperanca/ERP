import type { Account } from '@erp/contracts/access';
import { ApplicationError } from '@erp/contracts/common';
export function validateAccountChange(
  accounts: readonly Account[],
  updated: Account,
) {
  if (accounts.some((a) => a.id !== updated.id && a.login === updated.login))
    throw new ApplicationError('DOMAIN_CONFLICT', 'Login must be unique');
  if (
    (!updated.active || !updated.roles.includes('ADMINISTRATOR')) &&
    !accounts.some(
      (a) =>
        a.id !== updated.id && a.active && a.roles.includes('ADMINISTRATOR'),
    )
  )
    throw new ApplicationError(
      'DOMAIN_CONFLICT',
      'The last active administrator must be preserved',
    );
}
