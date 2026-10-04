import { z } from 'zod';
import { roleSchema } from './access';
import { idSchema, nameSchema, reasonSchema, revisionSchema } from './common';

export const loginSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,100}$/);
export const passwordSchema = z
  .string()
  .refine(
    (value) =>
      Array.from(value).length >= 12 &&
      new TextEncoder().encode(value).length <= 72 &&
      !value.includes('\0'),
    'Password must have at least 12 Unicode characters, at most 72 UTF-8 bytes and no NUL',
  );
export const roleCodesSchema = z
  .array(roleSchema)
  .min(1)
  .refine((values) => new Set(values).size === values.length)
  .transform((values) => values.sort());
export const userDtoSchema = z.object({
  id: idSchema,
  login: loginSchema,
  displayName: nameSchema,
  active: z.boolean(),
  mustChangePassword: z.boolean(),
  revision: revisionSchema,
  roleCodes: roleCodesSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type UserDto = z.infer<typeof userDtoSchema>;
export const loginInputSchema = z
  .object({ login: loginSchema, password: passwordSchema })
  .strict();
export const createUserSchema = z
  .object({
    login: loginSchema,
    displayName: nameSchema,
    initialPassword: passwordSchema,
    roleCodes: roleCodesSchema,
  })
  .strict();
export const updateUserSchema = z
  .object({
    expectedRevision: revisionSchema,
    displayName: nameSchema.optional(),
    roleCodes: roleCodesSchema.optional(),
  })
  .strict()
  .refine(
    (value) => value.displayName !== undefined || value.roleCodes !== undefined,
  );
export const activationSchema = z
  .object({
    expectedRevision: revisionSchema,
    active: z.boolean(),
    reason: reasonSchema,
  })
  .strict();
export const resetPasswordSchema = z
  .object({
    expectedRevision: revisionSchema,
    temporaryPassword: passwordSchema,
    reason: reasonSchema,
  })
  .strict();
export const changePasswordSchema = z
  .object({
    expectedRevision: revisionSchema,
    currentPassword: passwordSchema,
    newPassword: passwordSchema,
  })
  .strict();
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export const listUsersSchema = paginationSchema
  .extend({
    q: z.string().trim().min(2).max(200).optional(),
    active: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
  })
  .strict();
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ActivationInput = z.infer<typeof activationSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ListUsersInput = z.infer<typeof listUsersSchema>;
