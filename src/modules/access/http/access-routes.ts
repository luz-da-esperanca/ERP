import { readEnumFilter, readFactDate, readJsonBody, readPagination, readQuery, readRouteIdentifier } from '../../shared/http/request-validation.ts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requireIdempotencyKey } from '../../shared/audit-and-idempotency.ts';
import { forbiddenError } from '../../shared/errors.ts';
import type { AccessService, AuthenticatedPrincipal } from '../application/access-service.ts';
import {
  ACCESS_PROFILES,
  type AccessProfile,
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
        if (value.length > 0) {
          try { return decodeURIComponent(value); }
          catch { return undefined; }
        }
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

export function registerAccessRoutes(
  app: FastifyInstance,
  accessService: AccessService,
  authGuard: AuthGuard,
  secureCookies: boolean,
): void {
  const cookieAttributes = `Path=/; HttpOnly; SameSite=Lax${secureCookies ? '; Secure' : ''}`;
  app.post('/api/v1/auth/login', async (request, reply) => {
    const body = readJsonBody(request.body, ["loginIdentifier","password"]);
    const result = await accessService.login({
      login: body.loginIdentifier,
      password: body.password,
    });

    reply.header(
      'Set-Cookie',
      `${SESSION_COOKIE_NAME}=${encodeURIComponent(result.session.token)}; ${cookieAttributes}`,
    );

    return reply.code(200).send({
      sessionToken: result.session.token,
      expiresAt: result.session.idleExpiresAt,
      user: result.user,
    });
  });

  app.post('/api/v1/auth/logout', async (request, reply) => {
    const token = extractSessionToken(request);
    await accessService.logout(token);
    reply.header(
      'Set-Cookie',
      `${SESSION_COOKIE_NAME}=; ${cookieAttributes}; Max-Age=0`,
    );
    return reply.code(204).send();
  });

  app.get('/api/v1/auth/session', async (request, reply) => {
    const principal = await authGuard.requireAuthenticated(request);
    return reply.code(200).send({ expiresAt: principal.session.idleExpiresAt, user: principal.user });
  });

  app.get('/api/v1/users', async (request, reply) => {
    await authGuard.requireProfiles(request, ['ADMIN']);
    const query = readQuery(request.query, ['status', 'profile', 'page', 'pageSize']);
    const statusFilter = readEnumFilter(query.status, ['ACTIVE', 'DEACTIVATED'] as const);
    const profileFilter = readEnumFilter(query.profile, ACCESS_PROFILES);

    const page = await accessService.listUsers({
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(profileFilter ? { profile: profileFilter } : {}),
    }, readPagination(query));

    return reply.code(200).send(page);
  });

  app.post('/api/v1/users', async (request, reply) => {
    const principal = await authGuard.requireProfiles(request, ['ADMIN']);
    const operationId = requireIdempotencyKey(request.headers['idempotency-key']);
    const body = readJsonBody(request.body, ["loginIdentifier","displayName","password","profiles","factDate"]);
    const factDate = readFactDate(body);

    const result = await accessService.createUser({
      actorId: principal.user.id,
      operationId,
      login: body.loginIdentifier,
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
    const targetUserId = readRouteIdentifier(request.params);
    const body = readJsonBody(request.body, ["version","profiles","reason","factDate"]);
    const factDate = readFactDate(body);

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
    const targetUserId = readRouteIdentifier(request.params);
    const body = readJsonBody(request.body, ["version","reason","factDate"]);
    const factDate = readFactDate(body);

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
