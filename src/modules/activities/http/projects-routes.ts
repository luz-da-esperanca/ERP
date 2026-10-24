import type { FastifyInstance } from 'fastify';
import type { AccessProfile } from '../../access/domain/access-types.ts';
import type { AuthGuard } from '../../access/http/access-routes.ts';
import { requireIdempotencyKey } from '../../shared/audit-and-idempotency.ts';
import { invalidRequestError } from '../../shared/errors.ts';
import type { ProjectsService } from '../application/projects-service.ts';
import type { ProjectStatus } from '../domain/project-types.ts';

const READ_PROJECTS_PROFILES: readonly AccessProfile[] = [
  'COORDINATOR',
  'SOCIAL_ASSISTANCE',
  'PERIODIC_ACTIVITY',
  'POINT_IN_TIME_SERVICE',
  'STOCK_DISTRIBUTION',
];

const WRITE_PROJECTS_PROFILES: readonly AccessProfile[] = ['COORDINATOR'];

function asObjectRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw invalidRequestError('O corpo da requisição deve ser um objeto JSON válido.');
  }
  return body as Record<string, unknown>;
}

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
    const query = (request.query ?? {}) as Record<string, unknown>;
    const rawStatus = typeof query.status === 'string' ? query.status : undefined;
    const statusFilter: ProjectStatus | undefined =
      rawStatus === 'PLANNED' || rawStatus === 'ACTIVE' || rawStatus === 'CLOSED'
        ? rawStatus
        : undefined;
    const instituteId = typeof query.instituteId === 'string' ? query.instituteId : undefined;
    const search = typeof query.search === 'string' ? query.search : undefined;

    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20) || 20));

    const allMatching = await projectsService.listProjects({
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(instituteId ? { instituteId } : {}),
      ...(search ? { search } : {}),
    });

    const totalItems = allMatching.length;
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
    const startIndex = (page - 1) * pageSize;
    const items = allMatching.slice(startIndex, startIndex + pageSize);

    return reply.code(200).send({
      items,
      page,
      pageSize,
      totalItems,
      totalPages,
    });
  });

  app.get('/api/v1/projects/:id', async (request, reply) => {
    await authGuard.requireProfiles(request, READ_PROJECTS_PROFILES);
    const params = (request.params ?? {}) as Record<string, unknown>;
    const projectId = typeof params.id === 'string' ? params.id : '';
    const project = await projectsService.getProjectById(projectId);
    return reply.code(200).send(project);
  });

  app.post('/api/v1/projects', async (request, reply) => {
    const principal = await authGuard.requireProfiles(request, WRITE_PROJECTS_PROFILES);
    const operationId = requireIdempotencyKey(request.headers['idempotency-key']);
    const body = asObjectRecord(request.body);
    const factDate = typeof body.factDate === 'string' ? body.factDate : undefined;

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
    const params = (request.params ?? {}) as Record<string, unknown>;
    const projectId = typeof params.id === 'string' ? params.id : '';
    const body = asObjectRecord(request.body);
    const factDate = typeof body.factDate === 'string' ? body.factDate : undefined;

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
    const params = (request.params ?? {}) as Record<string, unknown>;
    const projectId = typeof params.id === 'string' ? params.id : '';
    const body = asObjectRecord(request.body);
    const factDate = typeof body.factDate === 'string' ? body.factDate : undefined;

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

