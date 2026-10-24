import { readEnumFilter, readFactDate, readIdentifierFilter, readJsonBody, readPagination, readQuery, readRouteIdentifier, readStringFilter } from '../../shared/http/request-validation.ts';
import type { FastifyInstance } from 'fastify';
import type { AccessProfile } from '../../access/domain/access-types.ts';
import type { AuthGuard } from '../../access/http/access-routes.ts';
import { requireIdempotencyKey } from '../../shared/audit-and-idempotency.ts';
import type { ProjectsService } from '../application/projects-service.ts';

const READ_PROJECTS_PROFILES: readonly AccessProfile[] = [
  'COORDINATOR',
  'SOCIAL_ASSISTANCE',
  'PERIODIC_ACTIVITY',
  'POINT_IN_TIME_SERVICE',
  'STOCK_DISTRIBUTION',
];

const WRITE_PROJECTS_PROFILES: readonly AccessProfile[] = ['COORDINATOR'];

export function registerProjectsRoutes(
  app: FastifyInstance,
  projectsService: ProjectsService,
  authGuard: AuthGuard,
): void {
  app.get('/api/v1/institutes', async (request, reply) => {
    await authGuard.requireProfiles(request, READ_PROJECTS_PROFILES);
    const items = await projectsService.listInstitutes();
    return reply.code(200).send({ items });
  });

  app.get('/api/v1/projects', async (request, reply) => {
    await authGuard.requireProfiles(request, READ_PROJECTS_PROFILES);
    const query = readQuery(request.query, ['status', 'instituteId', 'search', 'page', 'pageSize']);
    const statusFilter = readEnumFilter(query.status, ['PLANNED', 'ACTIVE', 'CLOSED'] as const);
    const instituteId = readIdentifierFilter(query.instituteId);
    const search = readStringFilter(query.search, 150);

    const page = await projectsService.listProjects({
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(instituteId ? { instituteId } : {}),
      ...(search ? { search } : {}),
    }, readPagination(query));
    return reply.code(200).send(page);
  });

  app.get('/api/v1/projects/:id', async (request, reply) => {
    await authGuard.requireProfiles(request, READ_PROJECTS_PROFILES);
    const projectId = readRouteIdentifier(request.params);
    const project = await projectsService.getProjectById(projectId);
    return reply.code(200).send(project);
  });

  app.post('/api/v1/projects', async (request, reply) => {
    const principal = await authGuard.requireProfiles(request, WRITE_PROJECTS_PROFILES);
    const operationId = requireIdempotencyKey(request.headers['idempotency-key']);
    const body = readJsonBody(request.body, ["name","description","startDate","endDate","status","instituteIds","factDate"]);
    const factDate = readFactDate(body);

    const result = await projectsService.createProject({
      actorId: principal.user.id,
      operationId,
      name: body.name,
      description: body.description,
      startDate: body.startDate,
      endDate: body.endDate,
      status: body.status,
      instituteIds: body.instituteIds,
      ...(factDate !== undefined ? { factDate } : {}),
    });

    return reply.code(result.statusCode).send(result.body);
  });

  app.patch('/api/v1/projects/:id', async (request, reply) => {
    const principal = await authGuard.requireProfiles(request, WRITE_PROJECTS_PROFILES);
    const operationId = requireIdempotencyKey(request.headers['idempotency-key']);
    const projectId = readRouteIdentifier(request.params);
    const body = readJsonBody(request.body, ["version","name","description","startDate","endDate","status","instituteIds","reason","factDate"]);
    const factDate = readFactDate(body);

    const updated = await projectsService.updateProject({
      actorId: principal.user.id,
      operationId,
      projectId,
      version: body.version,
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.startDate !== undefined ? { startDate: body.startDate } : {}),
      ...(body.endDate !== undefined ? { endDate: body.endDate } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.instituteIds !== undefined ? { instituteIds: body.instituteIds } : {}),
      reason: body.reason,
      ...(factDate !== undefined ? { factDate } : {}),
    });

    return reply.code(200).send(updated);
  });

  app.post('/api/v1/projects/:id/close', async (request, reply) => {
    const principal = await authGuard.requireProfiles(request, WRITE_PROJECTS_PROFILES);
    const operationId = requireIdempotencyKey(request.headers['idempotency-key']);
    const projectId = readRouteIdentifier(request.params);
    const body = readJsonBody(request.body, ["version","endDate","reason","factDate"]);
    const factDate = readFactDate(body);

    const closed = await projectsService.closeProject({
      actorId: principal.user.id,
      operationId,
      projectId,
      version: body.version,
      ...(body.endDate !== undefined ? { endDate: body.endDate } : {}),
      reason: body.reason,
      ...(factDate !== undefined ? { factDate } : {}),
    });

    return reply.code(200).send(closed);
  });
}
