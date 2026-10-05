import type { Role } from '@erp/contracts/access';
import type { Account, AccountProfilePatch } from '../domain/account.js';

export interface CreateUserInput {
  login: string;
  displayName: string;
  initialPassword: string;
  roleCodes: Role[];
}
export interface UpdateUserInput extends AccountProfilePatch {
  expectedRevision: number;
}
export interface ActivationInput {
  expectedRevision: number;
  active: boolean;
  reason: string;
}
export interface ResetPasswordInput {
  expectedRevision: number;
  temporaryPassword: string;
  reason: string;
}
export interface ChangePasswordInput {
  expectedRevision: number;
  currentPassword: string;
  newPassword: string;
}
export interface ListUsersInput {
  page: number;
  pageSize: number;
  q?: string;
  active?: boolean;
}
export interface AccountPage {
  data: Account[];
  pagination: { page: number; pageSize: number; total: number };
}
