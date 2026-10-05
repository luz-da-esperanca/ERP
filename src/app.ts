import Fastify, { LogController, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import { randomUUID } from 'node:crypto';
import type { Capability } from '@erp/contracts/access';
import type { HttpSettings } from './core/presentation/http-settings.js';
import { HttpError } from './core/presentation/http-error.js';
import { mapError } from './core/presentation/error-mapper.js';
import type { DataModeGuard } from './core/application/data-mode.js';
import type { AccessService } from './features/access/application/access-service.js';
import type { AccountsService } from './features/access/application/accounts-service.js';
import type { AuditService } from './features/audit/application/audit-service.js';
import { assertPermission } from './features/access/domain/permissions.js';
import { registerAccessRoutes } from './features/access/presentation/access-routes.js';
import { registerAuditRoutes } from './features/audit/presentation/audit-routes.js';

export interface AppServices {
  access: AccessService;
  accounts: AccountsService;
  audit: AuditService;
  dataMode: DataModeGuard;
}

export function createApp(
  config: HttpSettings,
  services: AppServices,
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
    const actor = await services.access.authenticate(
      request.cookies[config.cookieName],
    );
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
        throw new HttpError(
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
        throw new HttpError(403, 'FORBIDDEN', 'Operation not permitted', {
          rule: 'REQUEST_ORIGIN_REQUIRED',
        });
    }
    if (request.url !== '/api/v1/health')
      await services.dataMode.assertEnabled();
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
    const failure = mapError(error);
    if (failure.status === 500)
      app.log.error(
        { requestId: request.id, code: failure.code },
        'Request failed',
      );
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
  registerAccessRoutes(
    app,
    config,
    services.access,
    services.accounts,
    principal,
  );
  registerAuditRoutes(app, services.audit, principal);
  return app;
}
