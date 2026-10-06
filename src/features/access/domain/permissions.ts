import type { Capability, Role } from '@erp/contracts/access';
import { PermissionDeniedError } from './account-errors.js';
const social: readonly Capability[] = [
  'registration.read',
  'registration.write',
  'registration.merge',
  'participants.lookup',
  'socialForms.read',
  'socialForms.write',
  'projects.read',
  'attendance.read',
  'eligibility.read',
  'eligibility.evaluate',
  'reports.read',
  'audit.read',
];
export const roleCapabilities: Record<Role, readonly Capability[]> = {
  COORDINATION: [
    ...social,
    'projects.write',
    'attendance.write',
    'eligibility.policy.write',
    'featureDecisions.manage',
  ],
  SOCIAL_ASSISTANCE: social,
  ACTIVITY_MANAGER: [
    'participants.lookup',
    'projects.read',
    'attendance.read',
    'attendance.write',
    'reports.read',
    'audit.read',
  ],
  ADMINISTRATOR: ['accounts.manage', 'audit.read'],
};
/** Profiles whose accounts are offered as responsible for an activity or session. */
export const activityResponsibleRoles: readonly Role[] = [
  'COORDINATION',
  'ACTIVITY_MANAGER',
];
export const roleLabels: Record<Role, string> = {
  COORDINATION: 'Coordenação',
  SOCIAL_ASSISTANCE: 'Assistência social',
  ACTIVITY_MANAGER: 'Responsável por atividade',
  ADMINISTRATOR: 'Administrador',
};
export const capabilitiesFor = (roles: readonly Role[]): Capability[] =>
  [...new Set(roles.flatMap((role) => roleCapabilities[role]))].sort();
export function assertPermission(
  roles: readonly Role[],
  mustChangePassword: boolean,
  capability: Capability,
) {
  if (mustChangePassword)
    throw new PermissionDeniedError('PASSWORD_CHANGE_REQUIRED');
  if (!capabilitiesFor(roles).includes(capability))
    throw new PermissionDeniedError();
}
