export class ReportRuleError extends Error {
  constructor(readonly rule: string) {
    super(`Report rule violated: ${rule}`);
  }
}
export class ReportChangedError extends Error {
  constructor() {
    super('Report sources changed');
  }
}
