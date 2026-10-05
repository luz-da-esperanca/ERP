export type AccountRule =
  | 'LAST_ACTIVE_ADMINISTRATOR'
  | 'LOGIN_ALREADY_USED'
  | 'BOOTSTRAP_ALREADY_COMPLETED'
  | 'BOOTSTRAP_REQUIRES_ADMINISTRATOR';

export type PermissionRule = 'PASSWORD_CHANGE_REQUIRED';

export class AccountRuleError extends Error {
  constructor(readonly rule: AccountRule) {
    super('Operation violates a business rule');
    this.name = AccountRuleError.name;
  }
}

export class AccountRevisionConflictError extends Error {
  constructor(readonly currentRevision: number) {
    super('Resource revision changed');
    this.name = AccountRevisionConflictError.name;
  }
}

export class PermissionDeniedError extends Error {
  constructor(readonly rule?: PermissionRule) {
    super('Operation not permitted');
    this.name = PermissionDeniedError.name;
  }
}
