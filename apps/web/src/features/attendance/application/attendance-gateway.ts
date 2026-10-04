import type {
  ActivitySession,
  AttendanceContext,
  ConfirmSessionInput,
  SessionDetail,
  AttendanceStatus,
} from '@erp/contracts/attendance';
export interface AttendanceGateway {
  context(activityId: string, occurredAt: string): Promise<AttendanceContext>;
  list(activityId: string): Promise<ActivitySession[]>;
  get(id: string): Promise<SessionDetail>;
  confirm(
    input: ConfirmSessionInput,
    operationKey: string,
  ): Promise<ActivitySession>;
  correct(
    id: string,
    revision: number,
    entries: Array<{ personId: string; status: AttendanceStatus }>,
    reason: string,
  ): Promise<void>;
  cancel(id: string, revision: number, reason: string): Promise<void>;
}
