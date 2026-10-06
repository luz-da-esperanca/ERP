import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
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

describe('Social form HTTP transport', () => {
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
