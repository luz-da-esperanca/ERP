import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  missingDataSelectionInputSchema,
  missingDataSelectionSchema,
} from '@erp/contracts/data-quality-api';
import type { AuthenticateRequest } from '../../../core/presentation/authenticate-request.js';
import type { MissingDataSelectionService } from '../application/missing-data-selection-service.js';

export function registerMissingDataRoutes(
  app: FastifyInstance,
  service: MissingDataSelectionService,
  principal: AuthenticateRequest,
) {
  app.get('/api/v1/registration-field-selections/current', async (request) => ({
    data: missingDataSelectionSchema
      .nullable()
      .parse(
        await service.current(await principal(request, 'registration.read')),
      ),
  }));
  app.post('/api/v1/registration-field-selections', async (request, reply) => {
    const actor = await principal(request, 'featureDecisions.manage');
    const result = await service.publish(
      { actor, key: z.uuid().parse(request.headers['idempotency-key']) },
      missingDataSelectionInputSchema.parse(request.body),
    );
    return reply
      .code(201)
      .send({ data: missingDataSelectionSchema.parse(result) });
  });
}
