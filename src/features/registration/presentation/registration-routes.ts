import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createFamilySchema,
  familyDtoSchema,
  familyDetailSchema,
  createRegisteredPersonSchema,
  personRegistrationSchema,
  duplicateQuerySchema,
  duplicateCandidateSchema,
  updateFamilySchema,
  listPeopleSchema,
  peoplePageSchema,
  membershipTransferSchema,
  membershipTransferResultSchema,
  referenceChangeSchema,
  referenceChangeResultSchema,
} from '@erp/contracts/registration-api';
import type { RegistrationService } from '../application/registration-service.js';
import type { AuthenticateRequest } from '../../../core/presentation/authenticate-request.js';
import {
  listFamiliesSchema,
  familiesPageSchema,
  updatePersonSchema,
  personDtoSchema,
  personDetailSchema,
  participantIdentitySchema,
  sizesInputSchema,
  sizeProfileSchema,
  membershipClosureSchema,
  membershipChangeResultSchema,
  membershipCorrectionSchema,
} from '@erp/contracts/registration-api';
import {
  qualityQuerySchema,
  qualityPageSchema,
  qualityResolutionSchema,
  dataQualityIssueSchema,
} from '@erp/contracts/data-quality-api';

export function registerRegistrationRoutes(
  app: FastifyInstance,
  registration: RegistrationService,
  principal: AuthenticateRequest,
) {
  app.get('/api/v1/data-quality-issues', async (request) =>
    qualityPageSchema.parse(
      await registration.qualityIssues(
        await principal(request, 'registration.read'),
        qualityQuerySchema.parse(request.query),
      ),
    ),
  );
  app.post(
    '/api/v1/data-quality-issues/:issueId/resolution',
    async (request) => {
      const actor = await principal(request, 'registration.write');
      const { issueId } = z
        .object({ issueId: z.uuid() })
        .strict()
        .parse(request.params);
      return {
        data: dataQualityIssueSchema.parse(
          await registration.resolveQualityIssue(
            { actor, key: z.uuid().parse(request.headers['idempotency-key']) },
            issueId,
            qualityResolutionSchema.parse(request.body),
          ),
        ),
      };
    },
  );
  app.patch('/api/v1/memberships/:membershipId', async (request) => {
    const actor = await principal(request, 'registration.write');
    const { membershipId } = z
      .object({ membershipId: z.uuid() })
      .strict()
      .parse(request.params);
    return {
      data: membershipChangeResultSchema.parse(
        await registration.correctMembership(
          { actor, key: z.uuid().parse(request.headers['idempotency-key']) },
          membershipId,
          membershipCorrectionSchema.parse(request.body),
        ),
      ),
    };
  });
  app.get('/api/v1/families', async (request) =>
    familiesPageSchema.parse(
      await registration.families(
        await principal(request, 'registration.read'),
        listFamiliesSchema.parse(request.query),
      ),
    ),
  );
  app.get('/api/v1/people/:personId', async (request) => {
    const actor = await principal(request);
    const { personId } = z
      .object({ personId: z.uuid() })
      .strict()
      .parse(request.params);
    const { asOf } = z
      .object({ asOf: z.iso.datetime({ offset: true }).optional() })
      .strict()
      .parse(request.query);
    return {
      data: z
        .union([personDetailSchema, participantIdentitySchema])
        .parse(await registration.person(actor, personId, asOf)),
    };
  });
  app.patch('/api/v1/people/:personId', async (request) => {
    const actor = await principal(request, 'registration.write');
    const { personId } = z
      .object({ personId: z.uuid() })
      .strict()
      .parse(request.params);
    return {
      data: personDtoSchema.parse(
        await registration.updatePerson(
          { actor, key: z.uuid().parse(request.headers['idempotency-key']) },
          personId,
          updatePersonSchema.parse(request.body),
        ),
      ),
    };
  });
  app.put('/api/v1/people/:personId/sizes', async (request) => {
    const actor = await principal(request, 'registration.write');
    const { personId } = z
      .object({ personId: z.uuid() })
      .strict()
      .parse(request.params);
    return {
      data: sizeProfileSchema.parse(
        await registration.saveSizes(
          { actor, key: z.uuid().parse(request.headers['idempotency-key']) },
          personId,
          sizesInputSchema.parse(request.body),
        ),
      ),
    };
  });
  app.post('/api/v1/memberships/:membershipId/closure', async (request) => {
    const actor = await principal(request, 'registration.write');
    const { membershipId } = z
      .object({ membershipId: z.uuid() })
      .strict()
      .parse(request.params);
    return {
      data: membershipChangeResultSchema.parse(
        await registration.closeMembership(
          { actor, key: z.uuid().parse(request.headers['idempotency-key']) },
          membershipId,
          membershipClosureSchema.parse(request.body),
        ),
      ),
    };
  });
  app.post('/api/v1/families/:familyId/reference-changes', async (request) => {
    const actor = await principal(request, 'registration.write');
    const { familyId } = z
      .object({ familyId: z.uuid() })
      .strict()
      .parse(request.params);
    return {
      data: referenceChangeResultSchema.parse(
        await registration.changeReference(
          { actor, key: z.uuid().parse(request.headers['idempotency-key']) },
          familyId,
          referenceChangeSchema.parse(request.body),
        ),
      ),
    };
  });
  app.post('/api/v1/people/:personId/membership-transfers', async (request) => {
    const actor = await principal(request, 'registration.write');
    const { personId } = z
      .object({ personId: z.uuid() })
      .strict()
      .parse(request.params);
    return {
      data: membershipTransferResultSchema.parse(
        await registration.transferMembership(
          { actor, key: z.uuid().parse(request.headers['idempotency-key']) },
          personId,
          membershipTransferSchema.parse(request.body),
        ),
      ),
    };
  });
  app.get('/api/v1/people', async (request) =>
    peoplePageSchema.parse(
      await registration.people(
        await principal(request),
        listPeopleSchema.parse(request.query),
      ),
    ),
  );
  app.patch('/api/v1/families/:familyId', async (request) => {
    const actor = await principal(request, 'registration.write');
    const { familyId } = z
      .object({ familyId: z.uuid() })
      .strict()
      .parse(request.params);
    return {
      data: familyDtoSchema.parse(
        await registration.updateFamily(
          { actor, key: z.uuid().parse(request.headers['idempotency-key']) },
          familyId,
          updateFamilySchema.parse(request.body),
        ),
      ),
    };
  });
  app.get('/api/v1/duplicate-candidates', async (request) => {
    const actor = await principal(request, 'registration.read');
    return {
      data: z
        .array(duplicateCandidateSchema)
        .parse(
          await registration.duplicateCandidates(
            actor,
            duplicateQuerySchema.parse(request.query),
          ),
        ),
    };
  });
  app.post('/api/v1/people', async (request, reply) => {
    const actor = await principal(request, 'registration.write');
    const input = createRegisteredPersonSchema.parse(request.body);
    const key = z.uuid().parse(request.headers['idempotency-key']);
    const result = await registration.createPerson({ actor, key }, input);
    reply.code(201);
    return { data: personRegistrationSchema.parse(result) };
  });
  app.post('/api/v1/families', async (request, reply) => {
    const actor = await principal(request, 'registration.write');
    const input = createFamilySchema.parse(request.body);
    const key = z.uuid().parse(request.headers['idempotency-key']);
    const family = await registration.createFamily({ actor, key }, input);
    reply.code(201);
    return { data: familyDtoSchema.parse(family) };
  });
  app.get('/api/v1/families/:familyId', async (request) => {
    const actor = await principal(request, 'registration.read');
    const { familyId } = z
      .object({ familyId: z.uuid() })
      .strict()
      .parse(request.params);
    const { asOf } = z
      .object({ asOf: z.iso.datetime({ offset: true }).optional() })
      .strict()
      .parse(request.query);
    return {
      data: familyDetailSchema.parse(
        await registration.family(actor, familyId, asOf),
      ),
    };
  });
}
