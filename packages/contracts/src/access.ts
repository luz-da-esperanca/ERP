import { z } from 'zod';
import { idSchema, nameSchema, revisionSchema } from './common';

export const roleSchema = z.enum([
  'COORDINATION',
  'SOCIAL_ASSISTANCE',
  'ACTIVITY_MANAGER',
  'ADMINISTRATOR',
]);
export type Role = z.infer<typeof roleSchema>;
export type Capability =
  | 'registration.read'
  | 'registration.write'
  | 'registration.merge'
  | 'participants.lookup'
  | 'socialForms.read'
  | 'socialForms.write'
  | 'projects.read'
  | 'projects.write'
  | 'attendance.read'
  | 'attendance.write'
  | 'eligibility.read'
  | 'eligibility.evaluate'
  | 'eligibility.policy.write'
  | 'reports.read'
  | 'accounts.manage'
  | 'featureDecisions.manage'
  | 'audit.read';
export const accountInputSchema = z
  .object({
    login: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9._-]{3,100}$/),
    displayName: nameSchema,
    roles: z
      .array(roleSchema)
      .min(1)
      .refine((roles) => new Set(roles).size === roles.length),
  })
  .strict();
export const accountSchema = accountInputSchema.extend({
  id: idSchema,
  active: z.boolean(),
  revision: revisionSchema,
});
export type Account = z.infer<typeof accountSchema>;
export type AccountInput = z.infer<typeof accountInputSchema>;
export interface Session {
  user: Account;
  capabilities: Capability[];
}
