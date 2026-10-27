import { readEnumFilter, readJsonBody, readPagination, readQuery, readRouteIdentifier, readStringFilter } from '../../shared/http/request-validation.ts';
import type { FastifyInstance } from 'fastify';
import type { AccessProfile } from '../../access/domain/access-types.ts';
import type { AuthGuard } from '../../access/http/access-routes.ts';
import { requireIdempotencyKey } from '../../shared/audit-and-idempotency.ts';
import type { StockOriginsService } from '../application/stock-origins-service.ts';
import { STOCK_ORIGIN_KINDS } from '../domain/stock-origin-types.ts';

const READ_STOCK_ORIGINS_PROFILES: readonly AccessProfile[] = [
  'COORDINATOR',
  'SOCIAL_ASSISTANCE',
  'STOCK_DISTRIBUTION',
];

const WRITE_STOCK_ORIGINS_PROFILES: readonly AccessProfile[] = ['COORDINATOR', 'STOCK_DISTRIBUTION'];

export function registerStockOriginsRoutes(
  app: FastifyInstance,
  stockOriginsService: StockOriginsService,
  authGuard: AuthGuard,
): void {
  app.get('/api/v1/stock-origins', async (request, reply) => {
    await authGuard.requireProfiles(request, READ_STOCK_ORIGINS_PROFILES);
    const query = readQuery(request.query, ['kind', 'search', 'page', 'pageSize']);
    const kind = readEnumFilter(query.kind, STOCK_ORIGIN_KINDS);
    const search = readStringFilter(query.search, 150);

    const page = await stockOriginsService.listStockOrigins({
      ...(kind ? { kind } : {}),
      ...(search ? { search } : {}),
    }, readPagination(query));
    return reply.code(200).send(page);
  });

  app.get('/api/v1/stock-origins/:id', async (request, reply) => {
    await authGuard.requireProfiles(request, READ_STOCK_ORIGINS_PROFILES);
    const stockOriginId = readRouteIdentifier(request.params);
    const stockOrigin = await stockOriginsService.getStockOriginById(stockOriginId);
    return reply.code(200).send(stockOrigin);
  });

  app.post('/api/v1/stock-origins', async (request, reply) => {
    const principal = await authGuard.requireProfiles(request, WRITE_STOCK_ORIGINS_PROFILES);
    const operationId = requireIdempotencyKey(request.headers['idempotency-key']);
    const body = readJsonBody(request.body, ['kind', 'name']);

    const result = await stockOriginsService.createStockOrigin({
      actorId: principal.user.id,
      operationId,
      kind: body.kind,
      name: body.name,
    });

    return reply.code(result.statusCode).send(result.body);
  });
}
