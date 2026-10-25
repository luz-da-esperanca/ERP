import { randomUUID } from 'node:crypto';
import fastifyStatic from '@fastify/static';
import Fastify, { LogController } from 'fastify';
import { AccessService } from '../modules/access/application/access-service.ts';
import { accessSecurity } from '../modules/access/infrastructure/password-hasher.ts';
import type { SecurityPolicyConfig } from '../modules/access/domain/access-types.ts';
import { createAuthGuard, registerAccessRoutes } from '../modules/access/http/access-routes.ts';
import type { SeedUserInput } from '../modules/access/infrastructure/in-memory-access-repository.ts';
import { ProjectsService } from '../modules/activities/application/projects-service.ts';
import { registerProjectsRoutes } from '../modules/activities/http/projects-routes.ts';
import { StockOriginsService } from '../modules/social-stock/application/stock-origins-service.ts';
import { registerStockOriginsRoutes } from '../modules/social-stock/http/stock-origins-routes.ts';
import type { InMemoryAuditTrail } from '../modules/shared/infrastructure/in-memory-audit-and-idempotency.ts';
import { createInMemoryPersistence, type Persistence } from './persistence.ts';
import { ApplicationError } from '../modules/shared/errors.ts';
import { createProblem, createProblemFromError } from './problem-details.ts';
import { translatePersistenceError } from './persistence-errors.ts';

export interface AppOptions {
  checkDatabase: () => Promise<void>;
  clientDirectory?: string;
  logger?: boolean;
  secureCookies?: boolean;
  clock?: () => Date;
  securityConfig?: Partial<SecurityPolicyConfig>;
  seedUsers?: readonly SeedUserInput[];
  persistence?: Persistence;
  auditTrail?: InMemoryAuditTrail;
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
    const applicationError = error instanceof ApplicationError ? error : translatePersistenceError(error);
    if (applicationError) {
      if (applicationError.retryAfterSeconds !== undefined) {
        reply.header('Retry-After', String(applicationError.retryAfterSeconds));
      }
      return reply
        .code(applicationError.status)
        .type('application/problem+json')
        .send(createProblemFromError(applicationError, request.id));
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
  const persistence = options.persistence ?? createInMemoryPersistence(options.seedUsers ?? [], clock, options.auditTrail);
  const accessService = new AccessService({
    security: accessSecurity,
    repository: persistence.accessRepository, transactions: persistence.accessTransactions, clock,
    ...(options.securityConfig ? { securityConfig: options.securityConfig } : {}),
  });
  const projectsService = new ProjectsService({
    repository: persistence.projectsRepository, transactions: persistence.projectTransactions, clock,
  });
  const stockOriginsService = new StockOriginsService({
    repository: persistence.stockOriginsRepository, transactions: persistence.stockOriginTransactions, clock,
  });

  const authGuard = createAuthGuard(accessService);
  registerAccessRoutes(app, accessService, authGuard, options.secureCookies ?? false);
  registerProjectsRoutes(app, projectsService, authGuard);
  registerStockOriginsRoutes(app, stockOriginsService, authGuard);

  return app;
}
