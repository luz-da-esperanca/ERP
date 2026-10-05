import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthenticateRequest } from '../../access/infra/access-routes.js';
import { auditQuerySchema, type AuditStore } from './audit-store.js';
export function registerAuditRoutes(
  app: FastifyInstance,
  audit: AuditStore,
  principal: AuthenticateRequest,
) {
  app.get('/api/v1/audit-entries', async (request) =>
    audit.list(
      await principal(request, 'audit.read'),
      auditQuerySchema.parse(request.query),
    ),
  );
  app.get('/api/v1/audit-entries/:entryId', async (request) => {
    const actor = await principal(request, 'audit.read');
    const { entryId } = z
      .object({ entryId: z.uuid() })
      .strict()
      .parse(request.params);
    return { data: await audit.get(actor, entryId) };
  });
}
