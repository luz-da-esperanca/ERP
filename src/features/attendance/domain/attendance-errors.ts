export class AttendanceRuleError extends Error {
  constructor(readonly rule: string) {
    super(`Attendance rule violated: ${rule}`);
  }
}
export class AttendanceConflictError extends Error {
  constructor(
    readonly rule: string,
    readonly ids: string[] = [],
  ) {
    super(`Attendance conflict: ${rule}`);
  }
}
export class AttendanceRevisionConflictError extends Error {
  constructor(readonly currentRevision: number) {
    super('Attendance revision conflict');
  }
}
