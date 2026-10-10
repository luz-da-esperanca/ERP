import { z } from 'zod';
import {
  idSchema,
  nameSchema,
  revisionSchema,
  civilDateSchema,
  instantSchema,
  reasonSchema,
  optionalText,
  optionalDateSchema,
} from './common';
import { paginationSchema } from './access-api';
import { participantIdentitySchema } from './registration-api';

export const recordStatusSchema = z.enum(['ACTIVE', 'CLOSED']);
export const activityNatureSchema = z.enum(['PERIODIC', 'ONE_OFF']);
const codeSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[A-Z][A-Z0-9_]*$/);
const instantInput = instantSchema.transform((value) =>
  new Date(value).toISOString(),
);
const metadata = {
  id: idSchema,
  revision: revisionSchema,
  createdAt: instantSchema,
  updatedAt: instantSchema,
  createdBy: idSchema,
  updatedBy: idSchema,
};
const optionalProjectsText = (max: number) =>
  optionalText(max).transform((value) => (value === '' ? null : value));
const projectFields = z.object({
  name: nameSchema,
  instituteId: idSchema,
  description: optionalProjectsText(4000),
  startsOn: optionalDateSchema,
  endsOn: optionalDateSchema,
});
const activityFields = z.object({
  name: nameSchema,
  nature: activityNatureSchema,
  serviceTypeId: idSchema.nullable(),
  plannedSchedule: optionalProjectsText(500),
  responsibleId: idSchema.nullable(),
});
const hasChanges = (value: Record<string, unknown>) =>
  Object.keys(value).some(
    (key) => key !== 'expectedRevision' && key !== 'reason',
  );

export const instituteDtoSchema = z
  .object({
    id: idSchema,
    code: codeSchema,
    name: nameSchema,
    active: z.boolean(),
    revision: revisionSchema,
  })
  .strict();
export const serviceTypeDtoSchema = instituteDtoSchema;
export const projectDtoSchema = z
  .object({
    ...metadata,
    name: nameSchema,
    instituteId: idSchema,
    description: z.string().nullable(),
    startsOn: civilDateSchema.nullable(),
    endsOn: civilDateSchema.nullable(),
    status: recordStatusSchema,
    closedAt: instantSchema.nullable(),
  })
  .strict();
export const activityDtoSchema = z
  .object({
    ...metadata,
    projectId: idSchema,
    name: nameSchema,
    nature: activityNatureSchema,
    serviceTypeId: idSchema.nullable(),
    plannedSchedule: z.string().nullable(),
    responsibleId: idSchema.nullable(),
    status: recordStatusSchema,
    closedAt: instantSchema.nullable(),
  })
  .strict();
export const enrollmentDtoSchema = z
  .object({
    ...metadata,
    activityId: idSchema,
    personId: idSchema,
    validFrom: instantSchema,
    validUntil: instantSchema.nullable(),
    supersededById: idSchema.nullable(),
  })
  .strict();
export const createProjectSchema = projectFields.strict();
export const updateProjectSchema = projectFields
  .partial()
  .extend({ expectedRevision: revisionSchema })
  .strict()
  .refine(hasChanges);
export const createActivitySchema = activityFields
  .extend({
    expectedProjectRevision: revisionSchema,
    serviceTypeId: idSchema.nullable().default(null),
    responsibleId: idSchema.nullable().default(null),
  })
  .strict();
export const updateActivitySchema = activityFields
  .partial()
  .extend({ projectId: idSchema.optional(), expectedRevision: revisionSchema })
  .strict()
  .refine(hasChanges);
export const createServiceTypeSchema = z
  .object({ code: codeSchema, name: nameSchema })
  .strict();
export const updateCatalogSchema = z
  .object({
    expectedRevision: revisionSchema,
    name: nameSchema.optional(),
    active: z.boolean().optional(),
    reason: reasonSchema,
  })
  .strict()
  .refine(hasChanges);
export const closureSchema = z
  .object({
    expectedRevision: revisionSchema,
    effectiveAt: instantInput,
    reason: reasonSchema,
  })
  .strict();
export const createEnrollmentSchema = z
  .object({
    expectedActivityRevision: revisionSchema,
    personId: idSchema,
    // Omitted means "starting now"; the server stamps it from its own clock.
    validFrom: instantInput.optional(),
    validUntil: instantInput.nullable().default(null),
  })
  .strict();
export const correctEnrollmentSchema = z
  .object({
    expectedRevision: revisionSchema,
    validFrom: instantInput.optional(),
    validUntil: instantInput.nullable().optional(),
    reason: reasonSchema,
  })
  .strict()
  .refine(hasChanges);
export const closeEnrollmentSchema = z
  .object({
    expectedRevision: revisionSchema,
    validUntil: instantInput,
    reason: reasonSchema,
  })
  .strict();
export const catalogQuerySchema = paginationSchema
  .extend({
    active: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
  })
  .strict();
const search = z.string().trim().min(2).max(200).optional();
export const projectsQuerySchema = paginationSchema
  .extend({
    q: search,
    instituteId: idSchema.optional(),
    status: recordStatusSchema.optional(),
  })
  .strict();
export const activitiesQuerySchema = paginationSchema
  .extend({
    q: search,
    projectId: idSchema.optional(),
    nature: activityNatureSchema.optional(),
    status: recordStatusSchema.optional(),
  })
  .strict();
export const enrollmentsQuerySchema = paginationSchema
  .extend({ asOf: instantInput.optional(), personId: idSchema.optional() })
  .strict();
export const detailQuerySchema = z
  .object({ asOf: instantInput.optional() })
  .strict();
const page = <T extends z.ZodType>(schema: T) =>
  z
    .object({
      data: z.array(schema),
      pagination: paginationSchema.extend({
        total: z.number().int().nonnegative(),
      }),
    })
    .strict();
export const institutesPageSchema = page(instituteDtoSchema);
export const serviceTypesPageSchema = page(serviceTypeDtoSchema);
export const projectsPageSchema = page(projectDtoSchema);
export const activitiesPageSchema = page(activityDtoSchema);
export const enrollmentItemSchema = z
  .object({
    enrollment: enrollmentDtoSchema,
    person: participantIdentitySchema,
  })
  .strict();
export const enrollmentsPageSchema = page(enrollmentItemSchema);
export const projectDetailSchema = z
  .object({ project: projectDtoSchema, activities: z.array(activityDtoSchema) })
  .strict();
export const activityDetailSchema = z
  .object({
    activity: activityDtoSchema,
    project: projectDtoSchema,
    asOf: instantSchema,
    participantCount: z.number().int().nonnegative(),
  })
  .strict();
export const projectClosureResultSchema = z
  .object({
    project: projectDtoSchema,
    activities: z.array(activityDtoSchema),
    enrollments: z.array(enrollmentDtoSchema),
  })
  .strict();
export const activityClosureResultSchema = z
  .object({
    activity: activityDtoSchema,
    enrollments: z.array(enrollmentDtoSchema),
  })
  .strict();

export type InstituteDto = z.infer<typeof instituteDtoSchema>;
export type ServiceTypeDto = z.infer<typeof serviceTypeDtoSchema>;
export type ProjectDto = z.infer<typeof projectDtoSchema>;
export type ActivityDto = z.infer<typeof activityDtoSchema>;
export type EnrollmentDto = z.infer<typeof enrollmentDtoSchema>;
export type CreateProjectInput = z.input<typeof createProjectSchema>;
export type UpdateProjectInput = z.input<typeof updateProjectSchema>;
export type CreateActivityInput = z.input<typeof createActivitySchema>;
export type UpdateActivityInput = z.input<typeof updateActivitySchema>;
export type CreateServiceTypeInput = z.input<typeof createServiceTypeSchema>;
export type UpdateCatalogInput = z.input<typeof updateCatalogSchema>;
export type ClosureInput = z.input<typeof closureSchema>;
export type CreateEnrollmentInput = z.input<typeof createEnrollmentSchema>;
export type CorrectEnrollmentInput = z.input<typeof correctEnrollmentSchema>;
export type CloseEnrollmentInput = z.input<typeof closeEnrollmentSchema>;
export type CatalogQueryInput = z.input<typeof catalogQuerySchema>;
export type ProjectsQueryInput = z.input<typeof projectsQuerySchema>;
export type ActivitiesQueryInput = z.input<typeof activitiesQuerySchema>;
export type EnrollmentsQueryInput = z.input<typeof enrollmentsQuerySchema>;
export type InstitutesPageDto = z.infer<typeof institutesPageSchema>;
export type ServiceTypesPageDto = z.infer<typeof serviceTypesPageSchema>;
export type ProjectsPageDto = z.infer<typeof projectsPageSchema>;
export type ProjectDetailDto = z.infer<typeof projectDetailSchema>;
export type ActivitiesPageDto = z.infer<typeof activitiesPageSchema>;
export type ActivityDetailDto = z.infer<typeof activityDetailSchema>;
export type EnrollmentsPageDto = z.infer<typeof enrollmentsPageSchema>;
export type ProjectClosureResultDto = z.infer<
  typeof projectClosureResultSchema
>;
export type ActivityClosureResultDto = z.infer<
  typeof activityClosureResultSchema
>;
