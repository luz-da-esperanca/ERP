import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { registerSocialFormsRoutes } from '../../../../src/features/social-forms/presentation/social-forms-routes.js';
import { SocialFormsService } from '../../../../src/features/social-forms/application/social-forms-service.js';
import type {
  SocialFormsRepository,
  SocialFormsReadTransaction,
} from '../../../../src/features/social-forms/application/social-forms-ports.js';
import { createAccessServiceFixture } from '../../../support/access-service-fixture.js';
import { createAccountsServiceFixture } from '../../../support/accounts-service-fixture.js';
import { createSensitivePayloads } from '../../../../src/features/social-forms/infra/sensitive-payloads.js';
import { mapError } from '../../../../src/core/presentation/error-mapper.js';
import type { AuthenticateRequest } from '../../../../src/core/presentation/authenticate-request.js';

function createTemplateRouteFixture() {
  const { principal: original } = createAccessServiceFixture();
  const actor = {
    ...original,
    user: {
      ...original.user,
      roleCodes: ['SOCIAL_ASSISTANCE'] as ['SOCIAL_ASSISTANCE'],
    },
  };
  const repository: SocialFormsRepository = {
    read: async () => {
      throw new Error('Unexpected persistence effect');
    },
    run: async () => {
      throw new Error('Unexpected persistence effect');
    },
  };
  const service = new SocialFormsService(
    repository,
    createAccountsServiceFixture().fingerprints,
    createSensitivePayloads('', {}),
    () => '2026-10-09T12:00:00Z',
    () => actor.user.id,
    'SYNTHETIC',
  );
  const selection = {
    id: actor.user.id,
    version: 1,
    recordedAt: '2026-10-09T12:00:00Z',
    recordedBy: actor.user.id,
    fields: [],
    decisionReference: 'FAMILY_REGISTRATION_2025',
  };
  const prepareTemplate = vi
    .spyOn(service, 'prepareTemplate')
    .mockResolvedValue(selection);
  const authenticate = vi.fn<AuthenticateRequest>().mockResolvedValue(actor);
  const app = Fastify();
  app.setErrorHandler((error, _request, reply) => {
    const failure = mapError(error);
    return reply.code(failure.status).send({ error: { code: failure.code } });
  });
  registerSocialFormsRoutes(app, service, authenticate);
  return { app, actor, selection, prepareTemplate, authenticate };
}

describe('Social form HTTP transport', () => {
  it('prepares the fixed family form with social form write access and a UUID operation key', async () => {
    const { app, actor, selection, prepareTemplate, authenticate } =
      createTemplateRouteFixture();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/social-form-template',
        headers: { 'idempotency-key': actor.sessionId },
        payload: {},
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual({ data: selection });
      expect(authenticate).toHaveBeenCalledWith(
        expect.anything(),
        'socialForms.write',
      );
      expect(prepareTemplate).toHaveBeenCalledExactlyOnceWith({
        actor,
        key: actor.sessionId,
      });
    } finally {
      await app.close();
    }
  });

  it.each([
    {
      invalid: 'unexpected body fields',
      payload: { template: 'client-defined' },
      key: '00000000-0000-4000-8000-000000000002',
    },
    {
      invalid: 'missing body',
      payload: undefined,
      key: '00000000-0000-4000-8000-000000000002',
    },
    {
      invalid: 'array body',
      payload: [],
      key: '00000000-0000-4000-8000-000000000002',
    },
    { invalid: 'missing key', payload: {}, key: undefined },
    { invalid: 'invalid key', payload: {}, key: 'not-a-uuid' },
  ])(
    'rejects $invalid before preparing the fixed form',
    async ({ payload, key }) => {
      const { app, prepareTemplate } = createTemplateRouteFixture();
      try {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/social-form-template',
          headers: key ? { 'idempotency-key': key } : {},
          ...(payload === undefined ? {} : { payload }),
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().error.code).toBe('VALIDATION_ERROR');
        expect(prepareTemplate).not.toHaveBeenCalled();
      } finally {
        await app.close();
      }
    },
  );

  it('returns the disabled initial configuration and rejects client snapshots before starting a command', async () => {
    const { principal: original } = createAccessServiceFixture();
    const actor = {
      ...original,
      user: {
        ...original.user,
        roleCodes: ['COORDINATION'] as ['COORDINATION'],
      },
    };
    const tx = new Proxy(
      {
        configuration: async () => ({
          selection: null,
          options: [],
          decisions: [],
        }),
      },
      {
        get(target, key) {
          if (key in target) return Reflect.get(target, key);
          throw new Error('Unexpected persistence effect');
        },
      },
    ) as unknown as SocialFormsReadTransaction;
    const repository: SocialFormsRepository = {
      read: async (work) => work(tx),
      run: async () => {
        throw new Error('Unexpected persistence effect');
      },
    };
    const service = new SocialFormsService(
      repository,
      createAccountsServiceFixture().fingerprints,
      createSensitivePayloads('', {}),
      () => '2026-10-05T12:00:00Z',
      () => actor.user.id,
      'SYNTHETIC',
    );
    const app = Fastify();
    app.setErrorHandler((error, _request, reply) => {
      const failure = mapError(error);
      return reply.code(failure.status).send({ error: { code: failure.code } });
    });
    registerSocialFormsRoutes(app, service, async () => actor);
    try {
      const initial = await app.inject({
        method: 'GET',
        url: '/api/v1/social-form-fields',
      });
      expect(initial.statusCode).toBe(200);
      expect(initial.json().data).toEqual({
        selection: null,
        options: [],
        decisions: [],
      });
      const configuration = await app.inject({
        method: 'GET',
        url: '/api/v1/social-form-configuration',
      });
      expect(configuration.statusCode).toBe(200);
      expect(configuration.json().data).toEqual({
        selection: null,
        options: [],
        decisions: [],
      });
      const invalid = await app.inject({
        method: 'POST',
        url: `/api/v1/families/${actor.user.id}/social-forms`,
        headers: { 'idempotency-key': actor.user.id },
        payload: { familySnapshot: { name: 'Invented' } },
      });
      expect(invalid.statusCode).toBe(400);
      expect(invalid.json().error.code).toBe('VALIDATION_ERROR');
    } finally {
      await app.close();
    }
  });
});
