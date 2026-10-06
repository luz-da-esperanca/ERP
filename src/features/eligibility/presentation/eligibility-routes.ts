import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { EligibilityService } from '../application/eligibility-service.js';
import type { AuthenticateRequest } from '../../../core/presentation/authenticate-request.js';
import {
  assessmentCommandSchema,
  assessmentDtoSchema,
  eligibilityPreviewSchema,
  policiesPageSchema,
  policiesQuerySchema,
  policyVersionSchema,
  previewQuerySchema,
  publishPolicySchema,
} from '@erp/contracts/eligibility-api';

export function registerEligibilityRoutes(
  app: FastifyInstance,
  eligibility: EligibilityService,
  principal: AuthenticateRequest,
) {
  const params = z.object({ id: z.uuid() }).strict();
  const key = (value: unknown) => z.uuid().parse(value);
  app.get('/api/v1/eligibility-policies', async (request) =>
    policiesPageSchema.parse(
      await eligibility.policies(
        await principal(request, 'eligibility.read'),
        policiesQuerySchema.parse(request.query),
      ),
    ),
  );
  app.get('/api/v1/eligibility-policies/:id', async (request) => {
    const actor = await principal(request, 'eligibility.read');
    z.object({}).strict().parse(request.query);
    return {
      data: policyVersionSchema.parse(
        await eligibility.policy(actor, params.parse(request.params).id),
      ),
    };
  });
  app.post('/api/v1/eligibility-policies', async (request, reply) => {
    const actor = await principal(request, 'eligibility.policy.write');
    const policy = await eligibility.publishPolicy(
      { actor, key: key(request.headers['idempotency-key']) },
      publishPolicySchema.parse(request.body),
    );
    return reply.code(201).send({ data: policyVersionSchema.parse(policy) });
  });
  app.get('/api/v1/families/:id/eligibility-preview', async (request) => {
    const actor = await principal(request, 'eligibility.read');
    return {
      data: eligibilityPreviewSchema.parse(
        await eligibility.preview(
          actor,
          params.parse(request.params).id,
          previewQuerySchema.parse(request.query).referenceDate,
        ),
      ),
    };
  });
  app.post(
    '/api/v1/families/:id/eligibility-assessments',
    async (request, reply) => {
      const actor = await principal(request, 'eligibility.evaluate');
      const assessment = await eligibility.assess(
        { actor, key: key(request.headers['idempotency-key']) },
        params.parse(request.params).id,
        assessmentCommandSchema.parse(request.body).referenceDate,
      );
      return reply
        .code(201)
        .send({ data: assessmentDtoSchema.parse(assessment) });
    },
  );
  app.get('/api/v1/eligibility-assessments/:id', async (request) => {
    const actor = await principal(request, 'eligibility.read');
    z.object({}).strict().parse(request.query);
    return {
      data: assessmentDtoSchema.parse(
        await eligibility.assessment(actor, params.parse(request.params).id),
      ),
    };
  });
}
