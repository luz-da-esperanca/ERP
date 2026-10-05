import Fastify, { LogController, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Capability } from '@erp/contracts/access';
import type { ApiConfig } from './core/config.js';
import { ApiError, forbidden, dependencyUnavailable } from './core/errors.js';
import type { AccessService } from './features/access/application/access-service.js';
import { assertPermission } from './features/access/domain/permissions.js';
import { AuditStore } from './features/audit/infra/audit-store.js';
import type { Database } from './core/database.js';
import { Prisma } from './generated/prisma/client.js';
import { registerAccessRoutes } from './features/access/infra/access-routes.js';
import { registerAuditRoutes } from './features/audit/infra/audit-routes.js';

export async function assertDataMode(database: Database, config: ApiConfig) {
  if (config.DATA_MODE !== 'REAL') return;
  const decision = await database.featureDecision.findUnique({
    where: { code: 'REAL_PERSONAL_DATA' },
    select: { enabled: true, decisionReference: true },
  });
  if (!decision?.enabled || !decision.decisionReference.trim())
    throw new ApiError(
      422,
      'FEATURE_NOT_ENABLED',
      'Real personal data requires an institutional decision',
    );
}
export function createApp(
  config: ApiConfig,
  access: AccessService,
  database: Database,
  logging = false,
) {
  const app = Fastify({
    logger: logging
      ? {
          serializers: {
            req: (request) => ({ id: request.id, method: request.method }),
            res: (reply) => ({ statusCode: reply.statusCode }),
            err: () => ({
              type: 'Error',
              message: 'Operation failed',
              stack: '',
            }),
          },
        }
      : false,
    logController: new LogController({ disableRequestLogging: true }),
    bodyLimit: 1048576,
    genReqId: () => randomUUID(),
    trustProxy: config.TRUST_PROXY_ADDRESSES.length
      ? config.TRUST_PROXY_ADDRESSES
      : false,
  });
  app.register(cookie);
  async function principal(request: FastifyRequest, capability?: Capability) {
    const actor = await access.authenticate(request.cookies[config.cookieName]);
    if (capability)
      assertPermission(
        actor.user.roleCodes,
        actor.user.mustChangePassword,
        capability,
      );
    return actor;
  }
  app.addHook('onRequest', async (request) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      if (
        !/^application\/json(?:\s*;|$)/i.test(
          request.headers['content-type'] ?? '',
        )
      )
        throw new ApiError(
          415,
          'UNSUPPORTED_MEDIA_TYPE',
          'JSON content type required',
        );
      if (
        request.headers.origin !== config.APP_ORIGIN ||
        request.headers['x-erp-request'] !== '1' ||
        (request.headers['sec-fetch-site'] !== undefined &&
          request.headers['sec-fetch-site'] !== 'same-origin')
      )
        throw forbidden('REQUEST_ORIGIN_REQUIRED');
    }
    if (request.url !== '/api/v1/health')
      await assertDataMode(database, config);
  });
  app.addHook('onSend', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    reply.header('X-Content-Type-Options', 'nosniff');
  });
  app.addHook('onResponse', async (request, reply) => {
    if (logging)
      app.log.info(
        {
          requestId: request.id,
          method: request.method,
          status: reply.statusCode,
        },
        'Request completed',
      );
  });
  app.setErrorHandler((error, request, reply) => {
    let failure: ApiError;
    if (error instanceof ApiError) failure = error;
    else if (error instanceof z.ZodError)
      failure = new ApiError(400, 'VALIDATION_ERROR', 'Invalid request', {
        fields: [
          ...new Set(error.issues.map((issue) => issue.path.join('.'))),
        ].filter(Boolean),
      });
    else if (
      error instanceof Prisma.PrismaClientInitializationError ||
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P1001', 'P1002', 'P1017', 'P2024'].includes(error.code))
    )
      failure = dependencyUnavailable();
    else if (
      error instanceof Error &&
      'statusCode' in error &&
      error.statusCode === 400
    )
      failure = new ApiError(400, 'VALIDATION_ERROR', 'Invalid JSON request');
    else {
      failure = new ApiError(500, 'INTERNAL_ERROR', 'Internal server error');
      app.log.error(
        { requestId: request.id, code: failure.code },
        'Request failed',
      );
    }
    if (failure.retryAfter) reply.header('Retry-After', failure.retryAfter);
    reply.code(failure.status).send({
      error: {
        code: failure.code,
        message: failure.message,
        ...(failure.details ? { details: failure.details } : {}),
        requestId: request.id,
      },
    });
  });
  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send({
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found',
        requestId: request.id,
      },
    }),
  );
  app.get('/api/v1/health', async () => ({ data: { status: 'ok' } }));
  registerAccessRoutes(app, config, access, principal);
  registerAuditRoutes(app, new AuditStore(database), principal);
  return app;
}
