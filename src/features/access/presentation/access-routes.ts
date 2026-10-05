import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  loginInputSchema,
  createUserSchema,
  updateUserSchema,
  activationSchema,
  resetPasswordSchema,
  changePasswordSchema,
  listUsersSchema,
  userDtoSchema,
  usersPageSchema,
} from '@erp/contracts/access-api';
import { roleSchema } from '@erp/contracts/access';
import type { HttpSettings } from '../../../core/presentation/http-settings.js';
import type { AccessService } from '../application/access-service.js';
import type { AccountsService } from '../application/accounts-service.js';
import type { AuthenticateRequest } from '../../../core/presentation/authenticate-request.js';
import { roleCapabilities, roleLabels } from '../domain/permissions.js';
const idParams = z.object({ userId: z.uuid() }).strict();
const emptyBody = z.object({}).strict();
const idempotencyKeySchema = z.uuid();
export function registerAccessRoutes(
  app: FastifyInstance,
  config: HttpSettings,
  access: AccessService,
  accounts: AccountsService,
  principal: AuthenticateRequest,
) {
  const cookieOptions = {
    path: '/',
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: 'lax' as const,
  };
  const key = (request: FastifyRequest) =>
    idempotencyKeySchema.parse(request.headers['idempotency-key']);
  app.post('/api/v1/auth/login', async (request, reply) => {
    const input = loginInputSchema.parse(request.body);
    const result = await access.login(input.login, input.password, request.ip);
    reply.setCookie(config.cookieName, result.token, {
      ...cookieOptions,
      maxAge: config.SESSION_MAX_SECONDS,
    });
    return { data: result.data };
  });
  app.get('/api/v1/auth/session', async (request) => ({
    data: access.describe(await principal(request)),
  }));
  app.post('/api/v1/auth/logout', async (request, reply) => {
    emptyBody.parse(request.body);
    await access.logout(request.cookies[config.cookieName]);
    reply.clearCookie(config.cookieName, cookieOptions).code(204).send();
  });
  app.put('/api/v1/auth/password', async (request, reply) => {
    const actor = await principal(request);
    const result = await access.changePassword(
      actor,
      changePasswordSchema.parse(request.body),
    );
    reply.clearCookie(config.cookieName, cookieOptions);
    return { data: userDtoSchema.parse(result) };
  });
  app.get('/api/v1/users', async (request) => {
    const actor = await principal(request, 'accounts.manage');
    return usersPageSchema.parse(
      await accounts.list(actor, listUsersSchema.parse(request.query)),
    );
  });
  app.post('/api/v1/users', async (request, reply) => {
    const actor = await principal(request, 'accounts.manage');
    const input = createUserSchema.parse(request.body);
    const operationKey = key(request);
    const result = await access.createUser({ actor, key: operationKey }, input);
    reply.code(201);
    return { data: userDtoSchema.parse(result) };
  });
  app.patch('/api/v1/users/:userId', async (request) => {
    const actor = await principal(request, 'accounts.manage');
    const { userId } = idParams.parse(request.params);
    return {
      data: userDtoSchema.parse(
        await accounts.update(
          { actor, key: key(request) },
          userId,
          updateUserSchema.parse(request.body),
        ),
      ),
    };
  });
  app.post('/api/v1/users/:userId/activation', async (request) => {
    const actor = await principal(request, 'accounts.manage');
    const { userId } = idParams.parse(request.params);
    return {
      data: userDtoSchema.parse(
        await accounts.activate(
          { actor, key: key(request) },
          userId,
          activationSchema.parse(request.body),
        ),
      ),
    };
  });
  app.put('/api/v1/users/:userId/password', async (request) => {
    const actor = await principal(request, 'accounts.manage');
    const { userId } = idParams.parse(request.params);
    const input = resetPasswordSchema.parse(request.body);
    const operationKey = key(request);
    return {
      data: userDtoSchema.parse(
        await access.resetPassword({ actor, key: operationKey }, userId, input),
      ),
    };
  });
  app.get('/api/v1/roles', async (request) => {
    await principal(request, 'accounts.manage');
    return {
      data: roleSchema.options.map((code) => ({
        code,
        label: roleLabels[code],
        capabilities: roleCapabilities[code],
      })),
    };
  });
}
