import { z } from 'zod';
import type { ActivityDetail } from '@erp/contracts/projects';
import { apiQuery, allApiPages } from '../../../shared/api-query';
import * as contracts from '@erp/contracts/projects-api';
import { peoplePageSchema } from '@erp/contracts/registration-api';
import { responsibleCandidatesPageSchema } from '@erp/contracts/access-api';
import type { ApiClient } from '../../../shared/api-client';

export class HttpProjects {
  constructor(private readonly api: ApiClient) {}
  private async all<T>(
    path: string,
    schema: z.ZodType<{ data: T[]; pagination: { total: number } }>,
  ) {
    const data: T[] = [];
    for (let page = 1; ; page++) {
      const result = await this.api.request(
        `${path}${path.includes('?') ? '&' : '?'}page=${page}&pageSize=100`,
        schema,
      );
      data.push(...result.data);
      if (data.length >= result.pagination.total || !result.data.length)
        return data;
    }
  }
  overview = async () => {
    const [projects, activities, institutes, serviceTypes] = await Promise.all([
      this.all('/projects', contracts.projectsPageSchema),
      this.all('/activities', contracts.activitiesPageSchema),
      this.all('/institutes', contracts.institutesPageSchema),
      this.all('/service-types', contracts.serviceTypesPageSchema),
    ]);
    return { projects, activities, institutes, serviceTypes };
  };
  async activity(id: string, asOf: string) {
    return (
      await this.api.request(
        `/activities/${z.uuid().parse(id)}?asOf=${encodeURIComponent(asOf)}`,
        z.object({ data: contracts.activityDetailSchema }),
      )
    ).data;
  }
  enrollments(id: string, asOf?: string) {
    return this.all(
      `/activities/${z.uuid().parse(id)}/enrollments${asOf ? `?asOf=${encodeURIComponent(asOf)}` : ''}`,
      contracts.enrollmentsPageSchema,
    );
  }
  people = (q: string) =>
    this.all(`/people?q=${encodeURIComponent(q)}`, peoplePageSchema);
  responsible = () =>
    this.all('/responsible-candidates', responsibleCandidatesPageSchema);
  responsibleById = (id: string) =>
    this.all(
      `/responsible-candidates?ids=${z.uuid().parse(id)}`,
      responsibleCandidatesPageSchema,
    );
  private async write<T>(
    path: string,
    method: 'POST' | 'PATCH',
    body: unknown,
    key: string,
    schema: z.ZodType<T>,
  ) {
    return (
      await this.api.request(path, z.object({ data: schema }), {
        method,
        body,
        idempotencyKey: key,
      })
    ).data;
  }
  createProject(input: contracts.CreateProjectInput, key: string) {
    return this.write(
      '/projects',
      'POST',
      contracts.createProjectSchema.parse(input),
      key,
      contracts.projectDtoSchema,
    );
  }
  updateProject(id: string, input: contracts.UpdateProjectInput, key: string) {
    return this.write(
      `/projects/${z.uuid().parse(id)}`,
      'PATCH',
      contracts.updateProjectSchema.parse(input),
      key,
      contracts.projectDtoSchema,
    );
  }
  closeProject(id: string, input: contracts.ClosureInput, key: string) {
    return this.write(
      `/projects/${z.uuid().parse(id)}/closure`,
      'POST',
      contracts.closureSchema.parse(input),
      key,
      contracts.projectClosureResultSchema,
    );
  }
  createActivity(
    projectId: string,
    input: contracts.CreateActivityInput,
    key: string,
  ) {
    return this.write(
      `/projects/${z.uuid().parse(projectId)}/activities`,
      'POST',
      contracts.createActivitySchema.parse(input),
      key,
      contracts.activityDtoSchema,
    );
  }
  updateActivity(
    id: string,
    input: contracts.UpdateActivityInput,
    key: string,
  ) {
    return this.write(
      `/activities/${z.uuid().parse(id)}`,
      'PATCH',
      contracts.updateActivitySchema.parse(input),
      key,
      contracts.activityDtoSchema,
    );
  }
  closeActivity(id: string, input: contracts.ClosureInput, key: string) {
    return this.write(
      `/activities/${z.uuid().parse(id)}/closure`,
      'POST',
      contracts.closureSchema.parse(input),
      key,
      contracts.activityClosureResultSchema,
    );
  }
  enroll(id: string, input: contracts.CreateEnrollmentInput, key: string) {
    return this.write(
      `/activities/${z.uuid().parse(id)}/enrollments`,
      'POST',
      contracts.createEnrollmentSchema.parse(input),
      key,
      contracts.enrollmentDtoSchema,
    );
  }
  correctEnrollment(
    id: string,
    input: contracts.CorrectEnrollmentInput,
    key: string,
  ) {
    return this.write(
      `/enrollments/${z.uuid().parse(id)}`,
      'PATCH',
      contracts.correctEnrollmentSchema.parse(input),
      key,
      contracts.enrollmentDtoSchema,
    );
  }
  closeEnrollment(
    id: string,
    input: contracts.CloseEnrollmentInput,
    key: string,
  ) {
    return this.write(
      `/enrollments/${z.uuid().parse(id)}/closure`,
      'POST',
      contracts.closeEnrollmentSchema.parse(input),
      key,
      contracts.enrollmentDtoSchema,
    );
  }
  readonly getActivity = async (
    id: string,
    asOf: string,
  ): Promise<ActivityDetail> => {
    const { data } = await this.api.request(
      apiQuery(`/activities/${id}`, { asOf }),
      z.object({ data: contracts.activityDetailSchema }),
    );
    const enrollments = await allApiPages(
      this.api,
      `/activities/${id}/enrollments`,
      contracts.enrollmentsPageSchema,
      { asOf: data.asOf },
    );
    return {
      activity: data.activity,
      project: data.project,
      participants: enrollments.map(({ person }) => ({
        id: person.id,
        name: person.name,
        familyCode: person.family?.code ?? null,
        enrolled: true,
      })),
    };
  };
}
