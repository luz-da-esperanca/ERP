import { z } from 'zod';
import {
  activityDetailSchema,
  enrollmentsPageSchema,
  projectsPageSchema,
  activitiesPageSchema,
  institutesPageSchema,
  serviceTypesPageSchema,
} from '@erp/contracts/projects-api';
import type { ActivityDetail } from '@erp/contracts/projects';
import type { ApiClient } from '../../../shared/api-client';
import { apiQuery, allApiPages } from '../../../shared/api-query';

export class HttpProjects {
  constructor(private readonly api: ApiClient) {}

  readonly overview = async () => {
    const [projects, activities, institutes, serviceTypes] = await Promise.all([
      allApiPages(this.api, '/projects', projectsPageSchema),
      allApiPages(this.api, '/activities', activitiesPageSchema),
      allApiPages(this.api, '/institutes', institutesPageSchema),
      allApiPages(this.api, '/service-types', serviceTypesPageSchema),
    ]);
    return { projects, activities, institutes, serviceTypes };
  };

  readonly getActivity = async (
    id: string,
    asOf: string,
  ): Promise<ActivityDetail> => {
    const { data } = await this.api.request(
      apiQuery(`/activities/${id}`, { asOf }),
      z.object({ data: activityDetailSchema }),
    );
    const enrollments = await allApiPages(
      this.api,
      `/activities/${id}/enrollments`,
      enrollmentsPageSchema,
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
