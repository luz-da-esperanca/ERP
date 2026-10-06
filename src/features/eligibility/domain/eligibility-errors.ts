export class EligibilityRuleError extends Error {
  constructor(readonly rule: string) {
    super(`Eligibility rule violated: ${rule}`);
  }
}
export class EligibilityConflictError extends Error {
  constructor(
    readonly rule: string,
    readonly ids: string[] = [],
  ) {
    super(`Eligibility conflict: ${rule}`);
  }
}
