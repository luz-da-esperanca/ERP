import type { Prisma } from '../../../generated/prisma/client.js';
import {
  projectDtoSchema,
  activityDtoSchema,
  enrollmentDtoSchema,
} from '@erp/contracts/projects-api';
import type { Project, Activity, Enrollment } from '../domain/projects.js';
const metadataSelect = {
  id: true,
  revision: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
} as const;
export const projectSelect = {
  ...metadataSelect,
  name: true,
  instituteId: true,
  description: true,
  startsOn: true,
  endsOn: true,
  status: true,
  closedAt: true,
} satisfies Prisma.ProjectSelect;
export const activitySelect = {
  ...metadataSelect,
  projectId: true,
  name: true,
  nature: true,
  serviceTypeId: true,
  plannedSchedule: true,
  responsibleId: true,
  status: true,
  closedAt: true,
} satisfies Prisma.ActivitySelect;
export const enrollmentSelect = {
  ...metadataSelect,
  activityId: true,
  personId: true,
  validFrom: true,
  validUntil: true,
  supersededById: true,
} satisfies Prisma.ParticipantEnrollmentSelect;
export function projectRecord(
  row: Prisma.ProjectGetPayload<{ select: typeof projectSelect }>,
): Project {
  return projectDtoSchema.parse({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    startsOn: row.startsOn?.toISOString().slice(0, 10) ?? null,
    endsOn: row.endsOn?.toISOString().slice(0, 10) ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
  });
}
export function activityRecord(
  row: Prisma.ActivityGetPayload<{ select: typeof activitySelect }>,
): Activity {
  return activityDtoSchema.parse({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    closedAt: row.closedAt?.toISOString() ?? null,
  });
}
export function enrollmentRecord(
  row: Prisma.ParticipantEnrollmentGetPayload<{
    select: typeof enrollmentSelect;
  }>,
): Enrollment {
  return enrollmentDtoSchema.parse({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    validFrom: row.validFrom.toISOString(),
    validUntil: row.validUntil?.toISOString() ?? null,
  });
}
