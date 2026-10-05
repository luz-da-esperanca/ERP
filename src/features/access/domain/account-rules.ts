import type { Role } from '@erp/contracts/access';
import type {
  Account,
  AccountProfilePatch,
  AccountProfilePlan,
} from './account.js';
import {
  AccountRuleError,
  AccountRevisionConflictError,
} from './account-errors.js';
export function assertRevision(current: number, expected: number) {
  if (current !== expected) throw new AccountRevisionConflictError(current);
}
export function assertAdministratorRemains(
  currentActive: boolean,
  currentRoles: readonly Role[],
  nextActive: boolean,
  nextRoles: readonly Role[],
  activeAdministratorCount: number,
) {
  if (
    currentActive &&
    currentRoles.includes('ADMINISTRATOR') &&
    (!nextActive || !nextRoles.includes('ADMINISTRATOR')) &&
    activeAdministratorCount <= 1
  )
    throw new AccountRuleError('LAST_ACTIVE_ADMINISTRATOR');
}

export function planAccountProfileChange(
  account: Account,
  input: AccountProfilePatch,
  activeAdministratorCount: number,
): AccountProfilePlan {
  const displayName = input.displayName ?? account.displayName;
  const roleCodes = [...(input.roleCodes ?? account.roleCodes)].sort();
  assertAdministratorRemains(
    account.active,
    account.roleCodes,
    account.active,
    roleCodes,
    activeAdministratorCount,
  );
  return {
    displayName,
    roleCodes,
    changed:
      displayName !== account.displayName ||
      roleCodes.join() !== [...account.roleCodes].sort().join(),
  };
}

export function planAccountActivation(
  account: Account,
  active: boolean,
  activeAdministratorCount: number,
) {
  assertAdministratorRemains(
    account.active,
    account.roleCodes,
    active,
    account.roleCodes,
    activeAdministratorCount,
  );
  return { active, changed: active !== account.active };
}
