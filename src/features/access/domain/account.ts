import type { Role } from '@erp/contracts/access';

export interface Account {
  id: string;
  login: string;
  displayName: string;
  active: boolean;
  mustChangePassword: boolean;
  revision: number;
  roleCodes: Role[];
  createdAt: string;
  updatedAt: string;
}

export interface AccountProfilePatch {
  displayName?: string;
  roleCodes?: Role[];
}
export interface AccountProfilePlan {
  displayName: string;
  roleCodes: Role[];
  changed: boolean;
}
