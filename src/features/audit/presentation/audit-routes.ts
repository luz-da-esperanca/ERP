import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthenticateRequest } from '../../../core/presentation/authenticate-request.js';
import {
  auditQuerySchema,
  accountAuditEntrySchema,
  accountAuditPageSchema,
} from '@erp/contracts/account-audit-api';
import type { AuditService } from '../application/audit-service.js';
export function registerAuditRoutes(
  app: FastifyInstance,
  audit: AuditService,
  principal: AuthenticateRequest,
) {
  app.get('/api/v1/audit-entries', async (request) =>
    accountAuditPageSchema.parse(
      await audit.list(
        await principal(request, 'audit.read'),
        auditQuerySchema.parse(request.query),
      ),
    ),
  );
  app.get('/api/v1/audit-entries/:entryId', async (request) => {
    const actor = await principal(request, 'audit.read');
    const { entryId } = z
      .object({ entryId: z.uuid() })
      .strict()
      .parse(request.params);
    return {
      data: accountAuditEntrySchema.parse(await audit.get(actor, entryId)),
    };
  });
}
