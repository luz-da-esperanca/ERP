import { z } from 'zod';
import { idSchema, instantSchema, revisionSchema } from './common';

export const attendanceStatusSchema = z.enum(['PRESENT', 'ABSENT']);
export type AttendanceStatus = z.infer<typeof attendanceStatusSchema>;
export type SessionStatus = 'COMPLETED' | 'CANCELED';
export interface Attendance {
  personId: string;
  familyId: string;
  membershipId: string;
  status: AttendanceStatus;
}
export interface ActivitySession {
  id: string;
  activityId: string;
  responsibleId: string;
  occurredAt: string;
  recordedAt: string;
  recordedBy: string;
  status: SessionStatus;
  entries: Attendance[];
  revision: number;
}
export const confirmSessionSchema = z
  .object({
    activityId: idSchema,
    expectedRevision: revisionSchema,
    expectedContext: z.string(),
    occurredAt: instantSchema,
    responsibleId: idSchema,
    entries: z.array(
      z.object({ personId: idSchema, status: attendanceStatusSchema }).strict(),
    ),
  })
  .strict();
export type ConfirmSessionInput = z.infer<typeof confirmSessionSchema>;
export interface AttendanceContext {
  fingerprint: string;
  activityRevision: number;
  participants: Array<{ id: string; name: string; familyCode: string | null }>;
  operators: Array<{ id: string; name: string }>;
}
export interface SessionDetail {
  session: ActivitySession;
  activityName: string;
  participants: Array<{
    id: string;
    name: string;
    status: AttendanceStatus | null;
  }>;
}
