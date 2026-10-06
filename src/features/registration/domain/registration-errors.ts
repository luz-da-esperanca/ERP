export type RegistrationRule =
  | 'MEMBERSHIP_OVERLAP'
  | 'REFERENCE_OVERLAP'
  | 'FUTURE_MEMBERSHIP'
  | 'INVALID_MEMBERSHIP_INTERVAL'
  | 'FUTURE_BIRTH_DATE'
  | 'DUPLICATE_REVIEW_REQUIRED'
  | 'DUPLICATE_REVIEW_CHANGED'
  | 'MEMBERSHIP_NOT_CURRENT'
  | 'MEMBERSHIP_ATTENDANCE_CONFLICT'
  | 'SAME_FAMILY_TRANSFER'
  | 'FUTURE_SIZE_DATE'
  | 'SIZE_DATE_REQUIRED'
  | 'ISSUE_ALREADY_RESOLVED'
  | 'INVALID_ISSUE_RESOLUTION'
  | 'MERGE_SAME_IDENTITY'
  | 'MERGE_ENTITY_MISMATCH'
  | 'MERGE_SOURCES_CHANGED'
  | 'MERGE_RESOLUTION_REQUIRED'
  | 'MERGE_RESOLUTION_INVALID'
  | 'MERGE_REFERENCE_CONFLICT';

export class RegistrationConflictError extends Error {
  constructor(
    readonly rule: RegistrationRule,
    readonly ids: readonly string[] = [],
  ) {
    super('Registration operation conflicts with existing records');
  }
}
export class RegistrationRuleError extends Error {
  constructor(readonly rule: RegistrationRule) {
    super('Registration operation violates a business rule');
  }
}
export class RegistrationRevisionConflictError extends Error {
  constructor(readonly currentRevision: number | null) {
    super('Resource revision changed');
  }
}
