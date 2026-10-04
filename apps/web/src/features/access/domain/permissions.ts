import type { Role, Capability } from '@erp/contracts/access';

const social: Capability[] = [
  'registration.read',
  'registration.write',
  'socialForms.read',
  'socialForms.write',
  'projects.read',
  'attendance.read',
  'eligibility.read',
  'reports.read',
  'audit.read',
];
const rolePermissions: Record<Role, readonly Capability[]> = {
  COORDINATION: [...social, 'projects.write', 'attendance.write'],
  SOCIAL_ASSISTANCE: social,
  ACTIVITY_MANAGER: [
    'projects.read',
    'attendance.read',
    'attendance.write',
    'reports.read',
    'audit.read',
  ],
  ADMINISTRATOR: ['accounts.manage', 'audit.read'],
};
export const getCapabilities = (roles: readonly Role[]): Capability[] => [
  ...new Set(roles.flatMap((role) => rolePermissions[role])),
];
export const hasCapability = (roles: readonly Role[], capability: Capability) =>
  getCapabilities(roles).includes(capability);
