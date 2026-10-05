export type ProjectsRule =
  | 'INVALID_PROJECT_PERIOD'
  | 'INACTIVE_CATALOG'
  | 'INVALID_ACTIVITY_TYPE'
  | 'ACTIVITY_HAS_HISTORY'
  | 'ENROLLMENT_OVERLAP'
  | 'ENROLLMENT_OUTSIDE_VALIDITY'
  | 'INVALID_ENROLLMENT_INTERVAL'
  | 'PERSON_WITHOUT_MEMBERSHIP'
  | 'FUTURE_EFFECTIVE_DATE'
  | 'CLOSURE_CONFLICT'
  | 'PROJECT_PERIOD_CONFLICT'
  | 'RECORD_CLOSED'
  | 'CATALOG_CODE_EXISTS';

export class ProjectsRuleError extends Error {
  constructor(
    readonly rule: ProjectsRule,
    message = 'Projects operation violates a business rule',
  ) {
    super(message);
  }
}
export class ProjectsConflictError extends Error {
  constructor(
    readonly rule: ProjectsRule,
    readonly ids: readonly string[] = [],
  ) {
    super('Projects operation conflicts with existing records');
  }
}
export class ProjectsRevisionConflictError extends Error {
  constructor(readonly currentRevision: number) {
    super('Resource revision changed');
  }
}
