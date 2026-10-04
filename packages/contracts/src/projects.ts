import { z } from 'zod';
import {
  idSchema,
  nameSchema,
  optionalText,
  revisionSchema,
  optionalDateSchema,
  instantSchema,
} from './common';

export type RecordStatus = 'ACTIVE' | 'CLOSED';
export type ActivityNature = 'PERIODIC' | 'ONE_OFF';
export interface Institute {
  id: string;
  code: string;
  name: string;
  active: boolean;
}
export const projectInputSchema = z
  .object({
    name: nameSchema,
    instituteId: idSchema,
    description: optionalText(4000),
    startsOn: optionalDateSchema,
    endsOn: optionalDateSchema,
  })
  .strict()
  .refine((p) => !p.startsOn || !p.endsOn || p.startsOn <= p.endsOn);
export type ProjectInput = z.infer<typeof projectInputSchema>;
export interface Project extends ProjectInput {
  id: string;
  status: RecordStatus;
  closedAt: string | null;
  revision: number;
}
export const activityInputSchema = z
  .object({
    projectId: idSchema,
    name: nameSchema,
    nature: z.enum(['PERIODIC', 'ONE_OFF']),
    serviceTypeId: idSchema.nullable(),
    plannedSchedule: optionalText(500),
  })
  .strict()
  .refine((a) =>
    a.nature === 'PERIODIC'
      ? a.serviceTypeId === null
      : a.serviceTypeId !== null,
  );
export type ActivityInput = z.infer<typeof activityInputSchema>;
export interface Activity extends ActivityInput {
  id: string;
  status: RecordStatus;
  closedAt: string | null;
  revision: number;
}
export const enrollmentSchema = z.object({
  id: idSchema,
  activityId: idSchema,
  personId: idSchema,
  validFrom: instantSchema,
  validUntil: instantSchema.nullable(),
  revision: revisionSchema,
});
export type Enrollment = z.infer<typeof enrollmentSchema>;
export interface ServiceType {
  id: string;
  name: string;
  active: boolean;
}
export interface ProjectsOverview {
  institutes: Institute[];
  projects: Project[];
  activities: Activity[];
  serviceTypes: ServiceType[];
}
export interface Participant {
  id: string;
  name: string;
  familyCode: string | null;
  enrolled: boolean;
}
export interface ActivityDetail {
  activity: Activity;
  project: Project;
  participants: Participant[];
}
