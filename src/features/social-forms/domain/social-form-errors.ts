export type SocialFormRule =
  | 'INVALID_FIELD_SELECTION'
  | 'BLOCK_DISABLED'
  | 'FIELD_NOT_ALLOWED'
  | 'REQUIRED_FIELD_MISSING'
  | 'INVALID_OPTION'
  | 'INVALID_CARDINALITY'
  | 'INVALID_MEMBERS'
  | 'INVALID_REFERENCE_MEMBER'
  | 'INVALID_ACKNOWLEDGEMENT'
  | 'FUTURE_FACT'
  | 'DECISION_DEPENDENCY'
  | 'OPTION_CODE_EXISTS'
  | 'INVALID_CORRECTION';
export class SocialFormRuleError extends Error {
  constructor(readonly rule: SocialFormRule) {
    super(`Social form rule violated: ${rule}`);
  }
}
export class SocialFormConflictError extends Error {
  constructor(readonly rule: string) {
    super(`Social form base changed: ${rule}`);
  }
}
export class SocialFormRevisionConflictError extends Error {
  constructor(readonly currentRevision: number | null) {
    super('Resource revision changed');
  }
}
