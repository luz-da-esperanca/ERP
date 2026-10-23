import { randomUUID } from 'node:crypto';
import fastifyStatic from '@fastify/static';
import Fastify, { LogController } from 'fastify';
import { createProblem } from './problem-details.ts';

export interface AppOptions {
  checkDatabase: () => Promise<void>;
  clientDirectory?: string;
  logger?: boolean;
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
  return app;
}
