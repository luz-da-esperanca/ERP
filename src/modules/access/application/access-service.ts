import type { AuditTrailPort, IdempotencyPort } from '../../shared/audit-and-idempotency.ts';
import {
  authRequiredError,
  duplicateResourceError,
  invalidCredentialsError,
  rateLimitedError,
  resourceNotFoundError,
  staleVersionError,
  validationFailedError,
} from '../../shared/errors.ts';
import { generateUuidV7, isUuidV4OrV7 } from '../../shared/identifiers-and-time.ts';
import {
  DEFAULT_SECURITY_POLICY_CONFIG,
  normalizeLoginIdentifier,
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
import {
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from '../infrastructure/password-hasher.ts';

export interface AccessRepositoryPort {
  findUserByLogin(login: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  listUsers(filter?: {
    readonly status?: UserStatus;
    readonly profile?: AccessProfile;
  }): Promise<readonly UserRecord[]>;
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
  };
}

export interface LoginResult extends AuthenticatedPrincipal {
  readonly session: AuthenticatedPrincipal['session'] & {
    readonly token: string;
  };
}

export interface AccessServiceDependencies {
  readonly repository: AccessRepositoryPort;
  readonly auditTrail: AuditTrailPort;
  readonly idempotency: IdempotencyPort;
  readonly clock?: () => Date;
  readonly securityConfig?: Partial<SecurityPolicyConfig>;
}

export class AccessService {
  private readonly repository: AccessRepositoryPort;
  private readonly auditTrail: AuditTrailPort;
  private readonly idempotency: IdempotencyPort;
  private readonly clock: () => Date;
  private readonly securityConfig: SecurityPolicyConfig;

  constructor(deps: AccessServiceDependencies) {
    this.repository = deps.repository;
    this.auditTrail = deps.auditTrail;
    this.idempotency = deps.idempotency;
    this.clock = deps.clock ?? (() => new Date());
    this.securityConfig = {
      ...DEFAULT_SECURITY_POLICY_CONFIG,
      ...deps.securityConfig,
    };
  }

  async login(input: { readonly login: unknown; readonly password: unknown }): Promise<LoginResult> {
    const normalizedLogin = normalizeLoginIdentifier(input.login);
    const rawPassword = typeof input.password === 'string' ? input.password : '';

    if (normalizedLogin.length === 0 || rawPassword.length === 0) {
      throw validationFailedError([
        ...(normalizedLogin.length === 0
          ? [{ field: 'login', code: 'REQUIRED_FIELD', message: 'Informe o identificador de acesso.' }]
          : []),
        ...(rawPassword.length === 0
          ? [{ field: 'password', code: 'REQUIRED_FIELD', message: 'Informe a senha de acesso.' }]
          : []),
      ]);
    }

    const now = this.clock();
    const attemptState = await this.repository.getLoginAttemptState(normalizedLogin);
    if (attemptState?.lockedUntil) {
      const lockedUntilMs = Date.parse(attemptState.lockedUntil);
      if (lockedUntilMs > now.getTime()) {
        const retryAfterSeconds = Math.max(1, Math.ceil((lockedUntilMs - now.getTime()) / 1000));
        throw rateLimitedError(retryAfterSeconds);
      }
    }

    const user = await this.repository.findUserByLogin(normalizedLogin);
    const passwordMatches = verifyPassword(rawPassword, user?.passwordHash);

    if (!user || !passwordMatches || user.status !== 'ACTIVE') {
      await this.recordFailedAttempt(normalizedLogin, attemptState, now);
      throw invalidCredentialsError();
    }

    if (attemptState) {
      await this.repository.clearLoginAttemptState(normalizedLogin);
    }

    const { rawToken, tokenHash } = generateSessionToken();
    const issuedAt = now.toISOString();
    const idleExpiresAt = new Date(
      now.getTime() + this.securityConfig.sessionInactivityMinutes * 60_000,
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
    await this.repository.createSession(sessionRecord);

    return {
      user: toUserView(user),
      session: {
        id: sessionRecord.id,
        token: rawToken,
        issuedAt: sessionRecord.issuedAt,
        lastActivityAt: sessionRecord.lastActivityAt,
        idleExpiresAt: sessionRecord.idleExpiresAt,
      },
    };
  }

  async authenticateToken(rawToken: string | undefined): Promise<AuthenticatedPrincipal> {
    if (!rawToken || rawToken.trim().length === 0) {
      throw authRequiredError();
    }

    const now = this.clock();
    const tokenHash = hashSessionToken(rawToken.trim());
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
      now.getTime() + this.securityConfig.sessionInactivityMinutes * 60_000,
    ).toISOString();
    await this.repository.updateSessionActivity(session.id, lastActivityAt, idleExpiresAt);

    return {
      user: toUserView(user),
      session: {
        id: session.id,
        issuedAt: session.issuedAt,
        lastActivityAt,
        idleExpiresAt,
      },
    };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken || rawToken.trim().length === 0) {
      throw authRequiredError();
    }
    const principal = await this.authenticateToken(rawToken);
    const nowIso = this.clock().toISOString();
    await this.repository.revokeSessionById(principal.session.id, nowIso);
  }

  async listUsers(filter?: {
    readonly status?: UserStatus;
    readonly profile?: AccessProfile;
  }): Promise<readonly UserView[]> {
    const records = await this.repository.listUsers(filter);
    return records.map((record) => toUserView(record));
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
    const validated = validateUserCreationFields(input);
    const result = await this.idempotency.execute({
      operationType: 'CREATE_USER',
      actorId: input.actorId,
      operationId: input.operationId,
      payload: {
        login: validated.normalizedLogin,
        displayName: validated.displayName,
        profiles: validated.profiles,
        factDate: input.factDate ?? null,
      },
      run: async () => {
        const existing = await this.repository.findUserByLogin(validated.normalizedLogin);
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
          passwordHash: hashPassword(validated.password),
          status: 'ACTIVE',
          profiles: validated.profiles,
          version: 1,
          createdAt: nowIso,
          updatedAt: nowIso,
          deactivatedAt: null,
        };

        const saved = await this.repository.createUser(record);
        const view = toUserView(saved);

        await this.auditTrail.record({
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
    });

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
    const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
    if (reason.length === 0) {
      throw validationFailedError([
        {
          field: 'reason',
          code: 'REQUIRED_FIELD',
          message: 'A justificativa da alteração de perfis é obrigatória.',
        },
      ]);
    }

    const result = await this.idempotency.execute({
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
        const current = await this.repository.findUserById(input.targetUserId);
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
        const saved = await this.repository.updateUser(updatedRecord, expectedVersion);
        if (!saved) {
          throw staleVersionError();
        }

        const beforeView = toUserView(current);
        const afterView = toUserView(saved);

        await this.auditTrail.record({
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
    });

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
    const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
    if (reason.length === 0) {
      throw validationFailedError([
        {
          field: 'reason',
          code: 'REQUIRED_FIELD',
          message: 'A justificativa da desativação é obrigatória.',
        },
      ]);
    }

    const result = await this.idempotency.execute({
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
        const current = await this.repository.findUserById(input.targetUserId);
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
        const saved = await this.repository.updateUser(updatedRecord, expectedVersion);
        if (!saved) {
          throw staleVersionError();
        }

        await this.repository.revokeAllUserSessions(saved.id, nowIso);

        const beforeView = toUserView(current);
        const afterView = toUserView(saved);

        await this.auditTrail.record({
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
    });

    return result.body;
  }

  private async recordFailedAttempt(
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
      ? new Date(now.getTime() + this.securityConfig.lockoutDurationMinutes * 60_000).toISOString()
      : null;

    await this.repository.saveLoginAttemptState({
      login: normalizedLogin,
      failedAttempts,
      lockedUntil,
      updatedAt: now.toISOString(),
    });
  }
}

