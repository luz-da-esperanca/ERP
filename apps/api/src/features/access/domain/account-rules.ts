import type { Role } from '@erp/contracts/access';
import { businessRule, revisionConflict } from '../../../core/errors.js';
export function assertRevision(current: number, expected: number) {
  if (current !== expected) throw revisionConflict(current);
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
    throw businessRule('LAST_ACTIVE_ADMINISTRATOR');
}
