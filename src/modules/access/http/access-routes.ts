import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requireIdempotencyKey } from '../../shared/audit-and-idempotency.ts';
import { forbiddenError, invalidRequestError } from '../../shared/errors.ts';
import type { AccessService, AuthenticatedPrincipal } from '../application/access-service.ts';
import {
  ACCESS_PROFILES,
  type AccessProfile,
  type UserStatus,
} from '../domain/access-types.ts';

const SESSION_COOKIE_NAME = 'erp_session';

export function extractSessionToken(request: FastifyRequest): string | undefined {
  const authHeader = request.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token.length > 0) return token;
  }

  const cookieHeader = request.headers.cookie;
  if (typeof cookieHeader === 'string') {
    for (const part of cookieHeader.split(';')) {
      const [rawName, ...rest] = part.trim().split('=');
      if (rawName === SESSION_COOKIE_NAME) {
        const value = rest.join('=').trim();
        if (value.length > 0) return decodeURIComponent(value);
      }
    }
  }

  return undefined;
}

export interface AuthGuard {
  requireAuthenticated(request: FastifyRequest): Promise<AuthenticatedPrincipal>;
  requireProfiles(
    request: FastifyRequest,
    allowedProfiles: readonly AccessProfile[],
  ): Promise<AuthenticatedPrincipal>;
}

export function createAuthGuard(accessService: AccessService): AuthGuard {
  return {
    async requireAuthenticated(request: FastifyRequest): Promise<AuthenticatedPrincipal> {
      const token = extractSessionToken(request);
      return accessService.authenticateToken(token);
    },
    async requireProfiles(
      request: FastifyRequest,
      allowedProfiles: readonly AccessProfile[],
    ): Promise<AuthenticatedPrincipal> {
      const principal = await this.requireAuthenticated(request);
      const hasAllowedProfile = principal.user.profiles.some((profile) =>
        allowedProfiles.includes(profile),
      );
      if (!hasAllowedProfile) {
        throw forbiddenError();
      }
      return principal;
    },
  };
}

function asObjectRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw invalidRequestError('O corpo da requisição deve ser um objeto JSON válido.');
  }
  return body as Record<string, unknown>;
}

export function registerAccessRoutes(
  app: FastifyInstance,
  accessService: AccessService,
  authGuard: AuthGuard,
): void {
  app.post('/api/v1/auth/login', async (request, reply) => {
    const body = asObjectRecord(request.body);
    const result = await accessService.login({
      login: body.login,
      password: body.password,
    });

    reply.header(
      'Set-Cookie',
      `${SESSION_COOKIE_NAME}=${encodeURIComponent(result.session.token)}; Path=/; HttpOnly; SameSite=Lax`,
    );

    return reply.code(200).send(result);
  });

  app.post('/api/v1/auth/logout', async (request, reply) => {
    const token = extractSessionToken(request);
    await accessService.logout(token);
    reply.header(
      'Set-Cookie',
      `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    );
    return reply.code(204).send();
  });

  app.get('/api/v1/auth/session', async (request, reply) => {
    const principal = await authGuard.requireAuthenticated(request);
    return reply.code(200).send(principal);
  });

  app.get('/api/v1/users', async (request, reply) => {
    await authGuard.requireProfiles(request, ['ADMIN']);
    const query = (request.query ?? {}) as Record<string, unknown>;
    const rawStatus = typeof query.status === 'string' ? query.status : undefined;
    const rawProfile = typeof query.profile === 'string' ? query.profile : undefined;

    const statusFilter: UserStatus | undefined =
      rawStatus === 'ACTIVE' || rawStatus === 'DEACTIVATED' ? rawStatus : undefined;
    const profileFilter: AccessProfile | undefined =
      rawProfile && (ACCESS_PROFILES as readonly string[]).includes(rawProfile)
        ? (rawProfile as AccessProfile)
        : undefined;

    const items = await accessService.listUsers({
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(profileFilter ? { profile: profileFilter } : {}),
    });

    return reply.code(200).send({
      items,
      page: 1,
      pageSize: Math.max(20, items.length),
      totalItems: items.length,
      totalPages: items.length === 0 ? 0 : 1,
    });
  });

  app.post('/api/v1/users', async (request, reply) => {
    const principal = await authGuard.requireProfiles(request, ['ADMIN']);
    const operationId = requireIdempotencyKey(request.headers['idempotency-key']);
    const body = asObjectRecord(request.body);
    const factDate = typeof body.factDate === 'string' ? body.factDate : undefined;

    const result = await accessService.createUser({
      actorId: principal.user.id,
      operationId,
      login: body.login,
      displayName: body.displayName,
      password: body.password,
      profiles: body.profiles,
      ...(factDate !== undefined ? { factDate } : {}),
    });

    return reply.code(result.statusCode).send(result.body);
  });

  app.put('/api/v1/users/:id/profiles', async (request, reply) => {
    const principal = await authGuard.requireProfiles(request, ['ADMIN']);
    const operationId = requireIdempotencyKey(request.headers['idempotency-key']);
    const params = (request.params ?? {}) as Record<string, unknown>;
    const targetUserId = typeof params.id === 'string' ? params.id : '';
    const body = asObjectRecord(request.body);
    const factDate = typeof body.factDate === 'string' ? body.factDate : undefined;

    const updated = await accessService.updateUserProfiles({
      actorId: principal.user.id,
      operationId,
      targetUserId,
      version: body.version,
      profiles: body.profiles,
      reason: body.reason,
      ...(factDate !== undefined ? { factDate } : {}),
    });

    return reply.code(200).send(updated);
  });

  app.post('/api/v1/users/:id/deactivate', async (request, reply) => {
    const principal = await authGuard.requireProfiles(request, ['ADMIN']);
    const operationId = requireIdempotencyKey(request.headers['idempotency-key']);
    const params = (request.params ?? {}) as Record<string, unknown>;
    const targetUserId = typeof params.id === 'string' ? params.id : '';
    const body = asObjectRecord(request.body);
    const factDate = typeof body.factDate === 'string' ? body.factDate : undefined;

    const deactivated = await accessService.deactivateUser({
      actorId: principal.user.id,
      operationId,
      targetUserId,
      version: body.version,
      reason: body.reason,
      ...(factDate !== undefined ? { factDate } : {}),
    });

    return reply.code(200).send(deactivated);
  });
}

