import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { AuthenticateRequest } from '../../../core/presentation/authenticate-request.js';
import type { MembershipReconciliationService } from '../application/membership-reconciliation-service.js';
import {
  reconciliationPlanSchema,
  reconciliationCommandSchema,
  reconciliationPreviewSchema,
  reconciliationResultSchema,
} from '@erp/contracts/membership-reconciliation-api';
export function registerMembershipReconciliationRoutes(
  app: FastifyInstance,
  service: MembershipReconciliationService,
  principal: AuthenticateRequest,
) {
  const params = z.object({ id: z.uuid() }).strict();
  app.post(
    '/api/v1/people/:id/membership-reconciliations/preview',
    async (request) => {
      const actor = await principal(request, 'registration.write');
      return {
        data: reconciliationPreviewSchema.parse(
          await service.preview(
            actor,
            params.parse(request.params).id,
            reconciliationPlanSchema.parse(request.body),
          ),
        ),
      };
    },
  );
  app.post('/api/v1/people/:id/membership-reconciliations', async (request) => {
    const actor = await principal(request, 'registration.write');
    return {
      data: reconciliationResultSchema.parse(
        await service.confirm(
          { actor, key: z.uuid().parse(request.headers['idempotency-key']) },
          params.parse(request.params).id,
          reconciliationCommandSchema.parse(request.body),
        ),
      ),
    };
  });
}
