import { requireChangeReason } from '../../shared/change-reason.ts';
import { buildPage, DEFAULT_PAGINATION, type Page, type Pagination } from '../../shared/pagination.ts';
import type { MutationContext, TransactionRunner } from '../../shared/transactions.ts';
import {
  authRequiredError,
  csrfRejectedError,
  duplicateResourceError,
  invalidCredentialsError,
  rateLimitedError,
  resourceNotFoundError,
  staleVersionError,
  validationFailedError,
} from '../../shared/errors.ts';
import { generateUuidV7, isUuidV4OrV7, validateFactDate } from '../../shared/identifiers-and-time.ts';
import {
  DEFAULT_SECURITY_POLICY_CONFIG,
  validateLoginFields,
  toUserView,
  validateProfilesList,
  validateUserCreationFields,
  type AccessProfile,
  type LoginAttemptStateRecord,
  type SecurityPolicyConfig,
  type SessionRecord,
  type UserRecord,
  type UserStatus,
  type UserView,
} from '../domain/access-types.ts';
import type { AccessSecurityPort } from './access-security.ts';

export interface UserFilter {
    readonly status?: UserStatus;
    readonly profile?: AccessProfile;

}

export interface AccessRepositoryPort {
  lockInitialUserProvisioning(): Promise<void>;
  lockLoginState(login: string): Promise<void>;
  findUserByLogin(login: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  listUsers(filter?: UserFilter, pagination?: Pagination): Promise<readonly UserRecord[]>;
  countUsers(filter?: UserFilter): Promise<number>;
  createUser(record: UserRecord): Promise<UserRecord>;
  updateUser(record: UserRecord, expectedVersion: number): Promise<UserRecord | null>;
  createSession(session: SessionRecord): Promise<SessionRecord>;
  findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  updateSessionActivity(
    sessionId: string,
    lastActivityAt: string,
    idleExpiresAt: string,
  ): Promise<void>;
  revokeSessionById(sessionId: string, revokedAt: string): Promise<void>;
  revokeAllUserSessions(userId: string, revokedAt: string): Promise<void>;
  getLoginAttemptState(login: string): Promise<LoginAttemptStateRecord | null>;
  saveLoginAttemptState(state: LoginAttemptStateRecord): Promise<void>;
  clearLoginAttemptState(login: string): Promise<void>;
}

export interface AuthenticatedPrincipal {
  readonly user: UserView;
  readonly session: {
    readonly id: string;
    readonly issuedAt: string;
    readonly lastActivityAt: string;
    readonly idleExpiresAt: string;
    readonly csrfToken: string;
  };
}

export interface LoginResult extends AuthenticatedPrincipal {
  readonly session: AuthenticatedPrincipal['session'] & {
    readonly token: string;
  };
}

export interface AccessServiceDependencies {
  readonly security: AccessSecurityPort;
  readonly repository: AccessRepositoryPort;
  readonly transactions: TransactionRunner<MutationContext<AccessRepositoryPort>>;
  readonly clock?: () => Date;
  readonly securityConfig?: Partial<SecurityPolicyConfig>;
}

export class AccessService {
  private readonly security: AccessSecurityPort;
  private readonly repository: AccessRepositoryPort;
  private readonly transactions: TransactionRunner<MutationContext<AccessRepositoryPort>>;
  private readonly clock: () => Date;
  private readonly securityConfig: SecurityPolicyConfig;

  constructor(deps: AccessServiceDependencies) {
    this.security = deps.security;
    this.repository = deps.repository;
    this.transactions = deps.transactions;
    this.clock = deps.clock ?? (() => new Date());
    this.securityConfig = {
      ...DEFAULT_SECURITY_POLICY_CONFIG,
      ...deps.securityConfig,
    };
  }

  async provisionInitialAdministrator(input: {
    readonly loginIdentifier: unknown; readonly displayName: unknown; readonly password: unknown;
  }): Promise<UserView> {
    const validated = validateUserCreationFields({ ...input, login: input.loginIdentifier, profiles: ['ADMIN'] });
    return this.transactions(async ({ repository, auditTrail }) => {
      await repository.lockInitialUserProvisioning();
      if (await repository.countUsers() !== 0) {
        throw duplicateResourceError('O provisionamento inicial está desativado porque já existem usuários.');
      }
      const now = this.clock();
      const record: UserRecord = {
        id: generateUuidV7(now.getTime()), login: validated.normalizedLogin,
        displayName: validated.displayName, passwordHash: this.security.hashPassword(validated.password),
        status: 'ACTIVE', profiles: ['ADMIN'], version: 1,
        createdAt: now.toISOString(), updatedAt: now.toISOString(), deactivatedAt: null,
      };
      const saved = await repository.createUser(record);
      const view = toUserView(saved);
      await auditTrail.record({ actorId: saved.id, entityType: 'USER', entityId: saved.id,
        action: 'CREATE', before: null, after: { ...view },
        reason: 'Initial administrator provisioned through the authorized local command.',
      });
      return view;
    });
  }

  async login(input: { readonly login: unknown; readonly password: unknown }): Promise<LoginResult> {
    const { normalizedLogin, password: rawPassword } = validateLoginFields(input);

    const outcome = await this.transactions(async ({ repository }) => {
      await repository.lockLoginState(normalizedLogin);
      const now = this.clock();
      const attemptState = await repository.getLoginAttemptState(normalizedLogin);
      if (attemptState?.lockedUntil) {
        const lockedUntilMs = Date.parse(attemptState.lockedUntil);
        if (lockedUntilMs > now.getTime()) {
          const retryAfterSeconds = Math.max(1, Math.ceil((lockedUntilMs - now.getTime()) / 1000));
          return { error: rateLimitedError(retryAfterSeconds) };
        }
      }

      const user = await repository.findUserByLogin(normalizedLogin);
      const passwordMatches = this.security.verifyPassword(rawPassword, user?.passwordHash);

      if (!user || !passwordMatches || user.status !== 'ACTIVE') {
        await this.recordFailedAttempt(repository, normalizedLogin, attemptState, now);
        return { error: invalidCredentialsError() };
      }

      if (attemptState) {
        await repository.clearLoginAttemptState(normalizedLogin);
      }

      const { rawToken, tokenHash } = this.security.generateSessionToken();
      const issuedAt = now.toISOString();
      const idleExpiresAt = new Date(
        now.getTime() + this.securityConfig.sessionIdleTimeoutSeconds * 1000,
      ).toISOString();

      const sessionRecord: SessionRecord = {
        id: generateUuidV7(now.getTime()),
        userId: user.id,
        tokenHash,
        issuedAt,
        lastActivityAt: issuedAt,
        idleExpiresAt,
        revokedAt: null,
      };
      await repository.createSession(sessionRecord);

      return { value: {
        user: toUserView(user),
        session: {
          id: sessionRecord.id,
          token: rawToken,
          issuedAt: sessionRecord.issuedAt,
          lastActivityAt: sessionRecord.lastActivityAt,
          idleExpiresAt: sessionRecord.idleExpiresAt,
          csrfToken: sessionRecord.tokenHash,
        },
      } };
    });
    if (outcome.error) throw outcome.error;
    return outcome.value;
  }

  async authenticateToken(rawToken: string | undefined): Promise<AuthenticatedPrincipal> {
    if (!rawToken || rawToken.trim().length === 0) {
      throw authRequiredError();
    }

    const now = this.clock();
    const tokenHash = this.security.hashSessionToken(rawToken.trim());
    const session = await this.repository.findSessionByTokenHash(tokenHash);
    if (!session || session.revokedAt !== null) {
      throw authRequiredError();
    }

    if (Date.parse(session.idleExpiresAt) <= now.getTime()) {
      await this.repository.revokeSessionById(session.id, now.toISOString());
      throw authRequiredError();
    }

    // Re-read current user state and profiles on every request (RF-ACS-02 / RF-ACS-06 / AC-53)
    const user = await this.repository.findUserById(session.userId);
    if (!user || user.status !== 'ACTIVE') {
      await this.repository.revokeSessionById(session.id, now.toISOString());
      throw authRequiredError();
    }

    const lastActivityAt = now.toISOString();
    const idleExpiresAt = new Date(
      now.getTime() + this.securityConfig.sessionIdleTimeoutSeconds * 1000,
    ).toISOString();
    await this.repository.updateSessionActivity(session.id, lastActivityAt, idleExpiresAt);

    return {
      user: toUserView(user),
      session: {
        id: session.id,
        issuedAt: session.issuedAt,
        lastActivityAt,
        idleExpiresAt,
        csrfToken: session.tokenHash,
      },
    };
  }

  async verifyCsrfToken(rawSessionToken: string | undefined, csrfToken: unknown): Promise<void> {
    if (!rawSessionToken || typeof csrfToken !== 'string' || csrfToken.length === 0) {
      throw csrfRejectedError();
    }
    const session = await this.repository.findSessionByTokenHash(
      this.security.hashSessionToken(rawSessionToken),
    );
    if (!session || !this.security.isCsrfTokenValid(csrfToken, session.tokenHash)) {
      throw csrfRejectedError();
    }
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken || rawToken.trim().length === 0) {
      throw authRequiredError();
    }
    const principal = await this.authenticateToken(rawToken);
    const nowIso = this.clock().toISOString();
    await this.repository.revokeSessionById(principal.session.id, nowIso);
  }

  async listUsers(filter?: UserFilter, pagination: Pagination = DEFAULT_PAGINATION): Promise<Page<UserView>> {
    const [records, total] = await Promise.all([this.repository.listUsers(filter, pagination), this.repository.countUsers(filter)]);
    return buildPage(records.map(toUserView), total, pagination);
  }

  async createUser(input: {
    readonly actorId: string;
    readonly operationId: string;
    readonly login: unknown;
    readonly displayName: unknown;
    readonly password: unknown;
    readonly profiles: unknown;
    readonly factDate?: string;
  }): Promise<{ readonly statusCode: number; readonly body: UserView }> {
    validateFactDate(input.factDate);
    const validated = validateUserCreationFields(input);
    const result = await this.transactions(({ repository, auditTrail, idempotency }) => idempotency.execute({
      operationType: 'CREATE_USER',
      secret: validated.password,
      actorId: input.actorId,
      operationId: input.operationId,
      payload: {
        login: validated.normalizedLogin,
        displayName: validated.displayName,
        profiles: validated.profiles,
        factDate: input.factDate ?? null,
      },
      run: async () => {
        const existing = await repository.findUserByLogin(validated.normalizedLogin);
        if (existing) {
          throw duplicateResourceError(
            'Já existe um usuário cadastrado com este identificador de login.',
          );
        }

        const now = this.clock();
        const nowIso = now.toISOString();
        const record: UserRecord = {
          id: generateUuidV7(now.getTime()),
          login: validated.normalizedLogin,
          displayName: validated.displayName,
          passwordHash: this.security.hashPassword(validated.password),
          status: 'ACTIVE',
          profiles: validated.profiles,
          version: 1,
          createdAt: nowIso,
          updatedAt: nowIso,
          deactivatedAt: null,
        };

        const saved = await repository.createUser(record);
        const view = toUserView(saved);

        await auditTrail.record({
          actorId: input.actorId,
          ...(input.factDate !== undefined ? { factDate: input.factDate } : {}),
          entityType: 'USER',
          entityId: saved.id,
          action: 'CREATE',
          before: null,
          after: { ...view },
          operationId: input.operationId,
        });

        return { statusCode: 201, body: view };
      },
    }));

    return { statusCode: result.statusCode, body: result.body };
  }

  async updateUserProfiles(input: {
    readonly actorId: string;
    readonly operationId: string;
    readonly targetUserId: string;
    readonly version: unknown;
    readonly profiles: unknown;
    readonly reason: unknown;
    readonly factDate?: string;
  }): Promise<UserView> {
    validateFactDate(input.factDate);
    if (!isUuidV4OrV7(input.targetUserId)) {
      throw resourceNotFoundError('Usuário não encontrado.');
    }
    if (typeof input.version !== 'number' || !Number.isInteger(input.version) || input.version < 1) {
      throw validationFailedError([
        {
          field: 'version',
          code: 'INVALID_FORMAT',
          message: 'A versão do registro é obrigatória e deve ser um número inteiro positivo.',
        },
      ]);
    }
    const expectedVersion = input.version;
    const profiles = validateProfilesList(input.profiles, 'profiles');
    const reason = requireChangeReason(input.reason);

    const result = await this.transactions(({ repository, auditTrail, idempotency }) => idempotency.execute({
      operationType: 'UPDATE_USER_PROFILES',
      actorId: input.actorId,
      operationId: input.operationId,
      payload: {
        targetUserId: input.targetUserId,
        version: expectedVersion,
        profiles,
        reason,
        factDate: input.factDate ?? null,
      },
      run: async () => {
        const current = await repository.findUserById(input.targetUserId);
        if (!current) {
          throw resourceNotFoundError('Usuário não encontrado.');
        }
        if (current.version !== expectedVersion) {
          throw staleVersionError();
        }

        const nowIso = this.clock().toISOString();
        const updatedRecord: UserRecord = {
          ...current,
          profiles,
          version: current.version + 1,
          updatedAt: nowIso,
        };
        const saved = await repository.updateUser(updatedRecord, expectedVersion);
        if (!saved) {
          throw staleVersionError();
        }

        const beforeView = toUserView(current);
        const afterView = toUserView(saved);

        await auditTrail.record({
          actorId: input.actorId,
          ...(input.factDate !== undefined ? { factDate: input.factDate } : {}),
          entityType: 'USER',
          entityId: saved.id,
          action: 'UPDATE_PROFILES',
          before: { ...beforeView },
          after: { ...afterView },
          reason,
          operationId: input.operationId,
        });

        return { statusCode: 200, body: afterView };
      },
    }));

    return result.body;
  }

  async deactivateUser(input: {
    readonly actorId: string;
    readonly operationId: string;
    readonly targetUserId: string;
    readonly version: unknown;
    readonly reason: unknown;
    readonly factDate?: string;
  }): Promise<UserView> {
    validateFactDate(input.factDate);
    if (!isUuidV4OrV7(input.targetUserId)) {
      throw resourceNotFoundError('Usuário não encontrado.');
    }
    if (typeof input.version !== 'number' || !Number.isInteger(input.version) || input.version < 1) {
      throw validationFailedError([
        {
          field: 'version',
          code: 'INVALID_FORMAT',
          message: 'A versão do registro é obrigatória e deve ser um número inteiro positivo.',
        },
      ]);
    }
    const expectedVersion = input.version;
    const reason = requireChangeReason(input.reason);

    const result = await this.transactions(({ repository, auditTrail, idempotency }) => idempotency.execute({
      operationType: 'DEACTIVATE_USER',
      actorId: input.actorId,
      operationId: input.operationId,
      payload: {
        targetUserId: input.targetUserId,
        version: expectedVersion,
        reason,
        factDate: input.factDate ?? null,
      },
      run: async () => {
        const current = await repository.findUserById(input.targetUserId);
        if (!current) {
          throw resourceNotFoundError('Usuário não encontrado.');
        }
        if (current.version !== expectedVersion) {
          throw staleVersionError();
        }

        const nowIso = this.clock().toISOString();
        const updatedRecord: UserRecord = {
          ...current,
          status: 'DEACTIVATED',
          deactivatedAt: current.deactivatedAt ?? nowIso,
          version: current.version + 1,
          updatedAt: nowIso,
        };
        const saved = await repository.updateUser(updatedRecord, expectedVersion);
        if (!saved) {
          throw staleVersionError();
        }

        await repository.revokeAllUserSessions(saved.id, nowIso);

        const beforeView = toUserView(current);
        const afterView = toUserView(saved);

        await auditTrail.record({
          actorId: input.actorId,
          ...(input.factDate !== undefined ? { factDate: input.factDate } : {}),
          entityType: 'USER',
          entityId: saved.id,
          action: 'DEACTIVATE',
          before: { ...beforeView },
          after: { ...afterView },
          reason,
          operationId: input.operationId,
        });

        return { statusCode: 200, body: afterView };
      },
    }));

    return result.body;
  }

  private async recordFailedAttempt(
    repository: AccessRepositoryPort,
    normalizedLogin: string,
    previous: LoginAttemptStateRecord | null,
    now: Date,
  ): Promise<void> {
    const previousFailures =
      previous?.lockedUntil && Date.parse(previous.lockedUntil) <= now.getTime()
        ? 0
        : (previous?.failedAttempts ?? 0);
    const failedAttempts = previousFailures + 1;
    const isNowLocked = failedAttempts >= this.securityConfig.maxFailedLoginAttempts;
    const lockedUntil = isNowLocked
      ? new Date(now.getTime() + this.securityConfig.lockoutDurationSeconds * 1000).toISOString()
      : null;

    await repository.saveLoginAttemptState({
      login: normalizedLogin,
      failedAttempts,
      lockedUntil,
      updatedAt: now.toISOString(),
    });
  }
}
