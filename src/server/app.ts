import { randomUUID } from 'node:crypto';
import fastifyStatic from '@fastify/static';
import Fastify, { LogController } from 'fastify';
import {
  AccessService,
  type AccessRepositoryPort,
} from '../modules/access/application/access-service.ts';
import type { SecurityPolicyConfig } from '../modules/access/domain/access-types.ts';
import { createAuthGuard, registerAccessRoutes } from '../modules/access/http/access-routes.ts';
import {
  InMemoryAccessRepository,
  type SeedUserInput,
} from '../modules/access/infrastructure/in-memory-access-repository.ts';
import {
  ProjectsService,
  type ProjectsRepositoryPort,
} from '../modules/activities/application/projects-service.ts';
import { registerProjectsRoutes } from '../modules/activities/http/projects-routes.ts';
import { InMemoryProjectsRepository } from '../modules/activities/infrastructure/in-memory-projects-repository.ts';
import {
  InMemoryAuditTrail,
  InMemoryIdempotencyStore,
  type AuditTrailPort,
  type IdempotencyPort,
} from '../modules/shared/audit-and-idempotency.ts';
import { ApplicationError } from '../modules/shared/errors.ts';
import { createProblem, createProblemFromError } from './problem-details.ts';

export interface AppOptions {
  checkDatabase: () => Promise<void>;
  clientDirectory?: string;
  logger?: boolean;
  clock?: () => Date;
  securityConfig?: Partial<SecurityPolicyConfig>;
  seedUsers?: readonly SeedUserInput[];
  accessRepository?: AccessRepositoryPort;
  projectsRepository?: ProjectsRepositoryPort;
  auditTrail?: AuditTrailPort;
  idempotencyStore?: IdempotencyPort;
}

export function createApp(options: AppOptions) {
  const app = Fastify({
    genReqId: () => randomUUID(),
    logger: options.logger ?? false,
    logController: new LogController({ disableRequestLogging: true }),
  });
  if (options.clientDirectory) {
    app.register(fastifyStatic, { root: options.clientDirectory, wildcard: false });
  }
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApplicationError) {
      if (error.retryAfterSeconds !== undefined) {
        reply.header('Retry-After', String(error.retryAfterSeconds));
      }
      return reply
        .code(error.status)
        .type('application/problem+json')
        .send(createProblemFromError(error, request.id));
    }
    const status = error instanceof Error && 'statusCode' in error && error.statusCode === 400 ? 400 : 500;
    if (status === 500) request.log.error({ traceId: request.id }, 'Unhandled request failure');
    return reply.code(status).type('application/problem+json').send(createProblem(status, request.id));
  });
  app.setNotFoundHandler((request, reply) => {
    const path = request.url.split('?')[0] ?? '';
    const isApi = path === '/api' || path.startsWith('/api/');
    const isNavigation = (request.method === 'GET' || request.method === 'HEAD')
      && request.headers.accept?.includes('text/html');
    if (options.clientDirectory && isNavigation && !isApi) {
      return reply.type('text/html').sendFile('index.html');
    }
    return reply.code(404).type('application/problem+json').send(createProblem(404, request.id));
  });
  app.get('/api/v1/health', async () => ({ status: 'ok' }));
  app.get('/api/v1/ready', async (request, reply) => {
    try {
      await options.checkDatabase();
      return { status: 'ok' };
    } catch {
      request.log.warn({ traceId: request.id, dependency: 'postgresql' }, 'Readiness check failed');
      return reply.code(503).type('application/problem+json').send(createProblem(503, request.id));
    }
  });

  const clock = options.clock ?? (() => new Date());
  const auditTrail = options.auditTrail ?? new InMemoryAuditTrail(clock);
  const idempotencyStore = options.idempotencyStore ?? new InMemoryIdempotencyStore();
  const accessRepository =
    options.accessRepository ?? new InMemoryAccessRepository(options.seedUsers ?? []);
  const projectsRepository = options.projectsRepository ?? new InMemoryProjectsRepository();

  const accessService = new AccessService({
    repository: accessRepository,
    auditTrail,
    idempotency: idempotencyStore,
    clock,
    ...(options.securityConfig ? { securityConfig: options.securityConfig } : {}),
  });
  const projectsService = new ProjectsService({
    repository: projectsRepository,
    auditTrail,
    idempotency: idempotencyStore,
    clock,
  });

  const authGuard = createAuthGuard(accessService);
  registerAccessRoutes(app, accessService, authGuard);
  registerProjectsRoutes(app, projectsService, authGuard);

  return app;
}
