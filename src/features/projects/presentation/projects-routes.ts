import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  catalogQuerySchema,
  institutesPageSchema,
  serviceTypesPageSchema,
  instituteDtoSchema,
  serviceTypeDtoSchema,
  createServiceTypeSchema,
  updateCatalogSchema,
} from '@erp/contracts/projects-api';
import type { ProjectsService } from '../application/projects-service.js';
import type { AuthenticateRequest } from '../../../core/presentation/authenticate-request.js';
import {
  projectsQuerySchema,
  activitiesQuerySchema,
  createProjectSchema,
  updateProjectSchema,
  projectDtoSchema,
  projectDetailSchema,
  projectsPageSchema,
  activityDtoSchema,
  activityDetailSchema,
  activitiesPageSchema,
  createActivitySchema,
  updateActivitySchema,
  detailQuerySchema,
} from '@erp/contracts/projects-api';
import {
  enrollmentsQuerySchema,
  enrollmentsPageSchema,
  enrollmentDtoSchema,
  createEnrollmentSchema,
  correctEnrollmentSchema,
  closeEnrollmentSchema,
} from '@erp/contracts/projects-api';
import {
  closureSchema,
  projectClosureResultSchema,
  activityClosureResultSchema,
} from '@erp/contracts/projects-api';

export function registerProjectsRoutes(
  app: FastifyInstance,
  projects: ProjectsService,
  principal: AuthenticateRequest,
) {
  const params = z.object({ id: z.uuid() }).strict();
  app.post('/api/v1/projects/:id/closure', async (request) => {
    const actor = await principal(request, 'projects.write');
    return {
      data: projectClosureResultSchema.parse(
        await projects.closeProject(
          { actor, key: z.uuid().parse(request.headers['idempotency-key']) },
          params.parse(request.params).id,
          closureSchema.parse(request.body),
        ),
      ),
    };
  });
  app.post('/api/v1/activities/:id/closure', async (request) => {
    const actor = await principal(request, 'projects.write');
    return {
      data: activityClosureResultSchema.parse(
        await projects.closeActivity(
          { actor, key: z.uuid().parse(request.headers['idempotency-key']) },
          params.parse(request.params).id,
          closureSchema.parse(request.body),
        ),
      ),
    };
  });
  app.get('/api/v1/activities/:id/enrollments', async (request) => {
    const actor = await principal(request, 'projects.read');
    return enrollmentsPageSchema.parse(
      await projects.enrollments(
        actor,
        params.parse(request.params).id,
        enrollmentsQuerySchema.parse(request.query),
      ),
    );
  });
  app.post('/api/v1/activities/:id/enrollments', async (request, reply) => {
    const actor = await principal(request);
    return reply.code(201).send({
      data: enrollmentDtoSchema.parse(
        await projects.createEnrollment(
          { actor, key: z.uuid().parse(request.headers['idempotency-key']) },
          params.parse(request.params).id,
          createEnrollmentSchema.parse(request.body),
        ),
      ),
    });
  });
  app.patch('/api/v1/enrollments/:id', async (request) => {
    const actor = await principal(request);
    return {
      data: enrollmentDtoSchema.parse(
        await projects.correctEnrollment(
          { actor, key: z.uuid().parse(request.headers['idempotency-key']) },
          params.parse(request.params).id,
          correctEnrollmentSchema.parse(request.body),
        ),
      ),
    };
  });
  app.post('/api/v1/enrollments/:id/closure', async (request) => {
    const actor = await principal(request);
    return {
      data: enrollmentDtoSchema.parse(
        await projects.closeEnrollment(
          { actor, key: z.uuid().parse(request.headers['idempotency-key']) },
          params.parse(request.params).id,
          closeEnrollmentSchema.parse(request.body),
        ),
      ),
    };
  });
  app.get('/api/v1/projects', async (request) =>
    projectsPageSchema.parse(
      await projects.projects(
        await principal(request, 'projects.read'),
        projectsQuerySchema.parse(request.query),
      ),
    ),
  );
  app.get('/api/v1/projects/:id', async (request) => {
    const actor = await principal(request, 'projects.read');
    z.object({}).strict().parse(request.query);
    return {
      data: projectDetailSchema.parse(
        await projects.project(actor, params.parse(request.params).id),
      ),
    };
  });
  app.post('/api/v1/projects', async (request, reply) => {
    const actor = await principal(request, 'projects.write');
    return reply.code(201).send({
      data: projectDtoSchema.parse(
        await projects.createProject(
          { actor, key: z.uuid().parse(request.headers['idempotency-key']) },
          createProjectSchema.parse(request.body),
        ),
      ),
    });
  });
  app.patch('/api/v1/projects/:id', async (request) => {
    const actor = await principal(request, 'projects.write');
    return {
      data: projectDtoSchema.parse(
        await projects.updateProject(
          { actor, key: z.uuid().parse(request.headers['idempotency-key']) },
          params.parse(request.params).id,
          updateProjectSchema.parse(request.body),
        ),
      ),
    };
  });
  app.get('/api/v1/activities', async (request) =>
    activitiesPageSchema.parse(
      await projects.activities(
        await principal(request, 'projects.read'),
        activitiesQuerySchema.parse(request.query),
      ),
    ),
  );
  app.get('/api/v1/activities/:id', async (request) => {
    const actor = await principal(request, 'projects.read');
    return {
      data: activityDetailSchema.parse(
        await projects.activity(
          actor,
          params.parse(request.params).id,
          detailQuerySchema.parse(request.query).asOf,
        ),
      ),
    };
  });
  app.post('/api/v1/projects/:id/activities', async (request, reply) => {
    const actor = await principal(request, 'projects.write');
    return reply.code(201).send({
      data: activityDtoSchema.parse(
        await projects.createActivity(
          { actor, key: z.uuid().parse(request.headers['idempotency-key']) },
          params.parse(request.params).id,
          createActivitySchema.parse(request.body),
        ),
      ),
    });
  });
  app.patch('/api/v1/activities/:id', async (request) => {
    const actor = await principal(request, 'projects.write');
    return {
      data: activityDtoSchema.parse(
        await projects.updateActivity(
          { actor, key: z.uuid().parse(request.headers['idempotency-key']) },
          params.parse(request.params).id,
          updateActivitySchema.parse(request.body),
        ),
      ),
    };
  });
  app.get('/api/v1/institutes', async (request) =>
    institutesPageSchema.parse(
      await projects.catalogs(
        await principal(request, 'projects.read'),
        'Institute',
        catalogQuerySchema.parse(request.query),
      ),
    ),
  );
  app.get('/api/v1/service-types', async (request) =>
    serviceTypesPageSchema.parse(
      await projects.catalogs(
        await principal(request, 'projects.read'),
        'ServiceType',
        catalogQuerySchema.parse(request.query),
      ),
    ),
  );
  app.post('/api/v1/service-types', async (request, reply) => {
    const actor = await principal(request, 'projects.write');
    const data = await projects.createServiceType(
      { actor, key: z.uuid().parse(request.headers['idempotency-key']) },
      createServiceTypeSchema.parse(request.body),
    );
    return reply.code(201).send({ data: serviceTypeDtoSchema.parse(data) });
  });
  for (const [path, entity, schema] of [
    ['institutes', 'Institute', instituteDtoSchema],
    ['service-types', 'ServiceType', serviceTypeDtoSchema],
  ] as const) {
    app.patch(`/api/v1/${path}/:id`, async (request) => {
      const actor = await principal(request, 'projects.write');
      const { id } = z.object({ id: z.uuid() }).strict().parse(request.params);
      return {
        data: schema.parse(
          await projects.updateCatalog(
            { actor, key: z.uuid().parse(request.headers['idempotency-key']) },
            entity,
            id,
            updateCatalogSchema.parse(request.body),
          ),
        ),
      };
    });
  }
}
