import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { AuthenticateRequest } from '../../../core/presentation/authenticate-request.js';
import {
  mergeCommandSchema,
  mergeIdentitiesSchema,
  mergePreviewSchema,
  mergeResultSchema,
} from '@erp/contracts/identity-merge-api';
import type { IdentityMergeService } from '../application/identity-merge-service.js';

export function registerIdentityMergeRoutes(
  app: FastifyInstance,
  merges: IdentityMergeService,
  principal: AuthenticateRequest,
) {
  // The preview is a read with a body; it writes nothing and takes no idempotency key.
  app.post('/api/v1/identity-merges/preview', async (request) => {
    const actor = await principal(request, 'registration.merge');
    return {
      data: mergePreviewSchema.parse(
        await merges.preview(actor, mergeIdentitiesSchema.parse(request.body)),
      ),
    };
  });
  app.post('/api/v1/identity-merges', async (request, reply) => {
    const actor = await principal(request, 'registration.merge');
    const result = await merges.merge(
      { actor, key: z.uuid().parse(request.headers['idempotency-key']) },
      mergeCommandSchema.parse(request.body),
    );
    return reply.code(201).send({ data: mergeResultSchema.parse(result) });
  });
}
