import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthenticateRequest } from '../../../core/presentation/authenticate-request.js';
import type { SocialFormsService } from '../application/social-forms-service.js';
import {
  publishSocialFormSchema,
  socialFormDtoSchema,
  socialFormContextQuerySchema,
  socialFormContextSchema,
  socialFormListQuerySchema,
  socialFormPageSchema,
  fieldSelectionInputSchema,
  fieldSelectionDtoSchema,
  socialFormFieldsSchema,
  createSocialOptionSchema,
  updateSocialOptionSchema,
  socialOptionDtoSchema,
  featureDecisionCodeSchema,
  featureDecisionInputSchema,
  featureDecisionDtoSchema,
  acknowledgementCommandSchema,
  acknowledgementDtoSchema,
} from '@erp/contracts/social-forms-api';

export function registerSocialFormsRoutes(
  app: FastifyInstance,
  forms: SocialFormsService,
  principal: AuthenticateRequest,
) {
  const idParams = z.object({ id: z.uuid() }).strict();
  const templateInput = z.object({}).strict();
  const key = (headers: Record<string, unknown>) =>
    z.uuid().parse(headers['idempotency-key']);
  app.get('/api/v1/families/:id/social-form-context', async (request) => {
    const actor = await principal(request, 'socialForms.read');
    return {
      data: socialFormContextSchema.parse(
        await forms.context(
          actor,
          idParams.parse(request.params).id,
          socialFormContextQuerySchema.parse(request.query).occurredAt,
        ),
      ),
    };
  });
  app.get('/api/v1/families/:id/social-forms', async (request) => {
    const actor = await principal(request, 'socialForms.read');
    return socialFormPageSchema.parse(
      await forms.list(
        actor,
        idParams.parse(request.params).id,
        socialFormListQuerySchema.parse(request.query),
      ),
    );
  });
  app.post('/api/v1/families/:id/social-forms', async (request, reply) => {
    const actor = await principal(request, 'socialForms.write');
    const input = publishSocialFormSchema.parse(request.body);
    return reply.code(201).send({
      data: socialFormDtoSchema.parse(
        await forms.publish(
          { actor, key: key(request.headers) },
          idParams.parse(request.params).id,
          input,
        ),
      ),
    });
  });
  app.get('/api/v1/social-forms/:id', async (request) => {
    const actor = await principal(request, 'socialForms.read');
    z.object({}).strict().parse(request.query);
    return {
      data: socialFormDtoSchema.parse(
        await forms.get(actor, idParams.parse(request.params).id),
      ),
    };
  });
  app.post(
    '/api/v1/social-forms/:id/acknowledgements',
    async (request, reply) => {
      const actor = await principal(request, 'socialForms.write');
      return reply.code(201).send({
        data: acknowledgementDtoSchema.parse(
          await forms.acknowledge(
            { actor, key: key(request.headers) },
            idParams.parse(request.params).id,
            acknowledgementCommandSchema.parse(request.body),
          ),
        ),
      });
    },
  );
  app.get('/api/v1/social-form-configuration', async (request) => {
    const actor = await principal(request, 'featureDecisions.manage');
    z.object({}).strict().parse(request.query);
    return {
      data: socialFormFieldsSchema.parse(await forms.configuration(actor)),
    };
  });
  app.get('/api/v1/social-form-fields', async (request) => {
    const actor = await principal(request, 'socialForms.read');
    z.object({}).strict().parse(request.query);
    return { data: socialFormFieldsSchema.parse(await forms.fields(actor)) };
  });
  app.post('/api/v1/social-form-template', async (request, reply) => {
    const actor = await principal(request, 'socialForms.write');
    templateInput.parse(request.body);
    return reply.code(201).send({
      data: fieldSelectionDtoSchema.parse(
        await forms.prepareTemplate({ actor, key: key(request.headers) }),
      ),
    });
  });
  app.post('/api/v1/social-form-field-selections', async (request, reply) => {
    const actor = await principal(request, 'featureDecisions.manage');
    return reply.code(201).send({
      data: fieldSelectionDtoSchema.parse(
        await forms.configureSelection(
          { actor, key: key(request.headers) },
          fieldSelectionInputSchema.parse(request.body),
        ),
      ),
    });
  });
  app.post('/api/v1/social-form-options', async (request, reply) => {
    const actor = await principal(request, 'featureDecisions.manage');
    return reply.code(201).send({
      data: socialOptionDtoSchema.parse(
        await forms.createOption(
          { actor, key: key(request.headers) },
          createSocialOptionSchema.parse(request.body),
        ),
      ),
    });
  });
  app.patch('/api/v1/social-form-options/:id', async (request) => {
    const actor = await principal(request, 'featureDecisions.manage');
    return {
      data: socialOptionDtoSchema.parse(
        await forms.updateOption(
          { actor, key: key(request.headers) },
          idParams.parse(request.params).id,
          updateSocialOptionSchema.parse(request.body),
        ),
      ),
    };
  });
  app.post('/api/v1/feature-decisions/:code', async (request) => {
    const actor = await principal(request, 'featureDecisions.manage');
    const params = z
      .object({ code: featureDecisionCodeSchema })
      .strict()
      .parse(request.params);
    return {
      data: featureDecisionDtoSchema.parse(
        await forms.configureDecision(
          { actor, key: key(request.headers) },
          params.code,
          featureDecisionInputSchema.parse(request.body),
        ),
      ),
    };
  });
}
