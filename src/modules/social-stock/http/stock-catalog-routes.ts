import type { FastifyInstance } from 'fastify';
import type { AuthGuard } from '../../access/http/access-routes.ts';
import { requireIdempotencyKey } from '../../shared/audit-and-idempotency.ts';
import { readJsonBody, readPagination, readQuery, readRouteIdentifier } from '../../shared/http/request-validation.ts';
import type { StockCatalogService } from '../application/stock-catalog-service.ts';
import { invalidRequestError, resourceNotFoundError } from '../../shared/errors.ts';

// Prisma's integer pagination/revision arguments must fit the persistence representation.
const MAX_CATALOG_INDEX = 2_147_483_647;

function readCatalogPagination(query: unknown) {
  const pagination = readPagination(readQuery(query, ['page', 'pageSize']));
  if ((pagination.page - 1) * pagination.pageSize > MAX_CATALOG_INDEX) {
    throw invalidRequestError('A página solicitada excede a capacidade suportada.');
  }
  return pagination;
}

export function registerStockCatalogRoutes(app: FastifyInstance, service: StockCatalogService, authGuard: AuthGuard): void {
  const profiles = ['COORDINATOR', 'STOCK_DISTRIBUTION'] as const;
  for (const [resource, kind] of [['stock-categories', 'CATEGORY'], ['stock-units', 'UNIT'], ['stock-sizes', 'SIZE']] as const) {
    app.get(`/api/v1/${resource}`, async (request) => {
      await authGuard.requireProfiles(request, profiles);
      return service.listOptions(kind, readCatalogPagination(request.query));
    });
    app.get(`/api/v1/${resource}/:id`, async (request) => {
      await authGuard.requireProfiles(request, profiles);
      return service.getOption(kind, readRouteIdentifier(request.params));
    });
    app.post(`/api/v1/${resource}`, async (request, reply) => {
      const principal = await authGuard.requireProfiles(request, profiles);
      const operationId = requireIdempotencyKey(request.headers['idempotency-key']);
      const body = readJsonBody(request.body, kind === 'UNIT' ? ['name', 'precision'] : ['name']);
      const result = await service.createOption(kind, { actorId: principal.user.id, operationId, name: body.name, precision: body.precision });
      return reply.code(result.statusCode).send(result.body);
    });
    app.patch(`/api/v1/${resource}/:id`, async (request, reply) => {
      const principal = await authGuard.requireProfiles(request, profiles);
      const operationId = requireIdempotencyKey(request.headers['idempotency-key']);
      const body = readJsonBody(request.body, ['isActive', 'version', 'reason']);
      const result = await service.updateOption(kind, { actorId: principal.user.id, operationId,
        id: readRouteIdentifier(request.params), isActive: body.isActive, version: body.version, reason: body.reason });
      return reply.code(result.statusCode).send(result.body);
    });
  }
  app.get('/api/v1/stock-items', async (request) => {
    await authGuard.requireProfiles(request, profiles);
    return service.listItems(readCatalogPagination(request.query));
  });
  app.get('/api/v1/stock-items/:id', async (request) => {
    await authGuard.requireProfiles(request, profiles);
    return service.getItem(readRouteIdentifier(request.params));
  });
  app.post('/api/v1/stock-items', async (request, reply) => {
    const principal = await authGuard.requireProfiles(request, profiles);
    const operationId = requireIdempotencyKey(request.headers['idempotency-key']);
    const body = readJsonBody(request.body, ['name', 'categoryId', 'unitId', 'sizeId']);
    const result = await service.createItem({ actorId: principal.user.id, operationId,
      name: body.name, categoryId: body.categoryId, unitId: body.unitId, sizeId: body.sizeId });
    return reply.code(result.statusCode).send(result.body);
  });
  app.get<{ Params: { id: string; version: string } }>('/api/v1/stock-items/:id/revisions/:version', async (request) => {
    await authGuard.requireProfiles(request, profiles);
    const version = Number(request.params.version);
    if (!/^\d+$/.test(request.params.version) || !Number.isSafeInteger(version) || version < 1 || version > MAX_CATALOG_INDEX) throw resourceNotFoundError();
    return service.getItem(readRouteIdentifier(request.params), version);
  });
  app.patch('/api/v1/stock-items/:id', async (request, reply) => {
    const principal = await authGuard.requireProfiles(request, profiles);
    const operationId = requireIdempotencyKey(request.headers['idempotency-key']);
    const body = readJsonBody(request.body, ['name', 'categoryId', 'unitId', 'sizeId', 'isActive', 'version', 'reason']);
    const result = await service.updateItem({ actorId: principal.user.id, operationId, id: readRouteIdentifier(request.params),
      name: body.name, categoryId: body.categoryId, unitId: body.unitId, sizeId: body.sizeId,
      isActive: body.isActive, version: body.version, reason: body.reason });
    return reply.code(result.statusCode).send(result.body);
  });
}
