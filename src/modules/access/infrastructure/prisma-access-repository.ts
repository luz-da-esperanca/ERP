import { DEFAULT_PAGINATION, type Pagination } from '../../shared/pagination.ts';
import type { UserFilter } from '../application/access-service.ts';
import type { Prisma } from '../../../server/generated/prisma/client.ts';
import type { AccessRepositoryPort } from '../application/access-service.ts';
import {
  normalizeLoginIdentifier,
  type AccessProfile,
  type LoginAttemptStateRecord,
  type SessionRecord,
  type UserRecord,
  type UserStatus,
} from '../domain/access-types.ts';

interface PrismaUserWithProfiles {
  readonly id: string;
  readonly login: string;
  readonly displayName: string;
  readonly passwordHash: string;
  readonly status: string;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deactivatedAt: Date | null;
  readonly profiles: ReadonlyArray<{ readonly profile: string }>;
}

function mapUserRow(row: PrismaUserWithProfiles): UserRecord {
  return {
    id: row.id,
    login: row.login,
    displayName: row.displayName,
    passwordHash: row.passwordHash,
    status: row.status as UserStatus,
    profiles: row.profiles.map((p) => p.profile as AccessProfile),
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deactivatedAt: row.deactivatedAt ? row.deactivatedAt.toISOString() : null,
  };
}

export class PrismaAccessRepository implements AccessRepositoryPort {
  private readonly client: Prisma.TransactionClient;

  constructor(client: Prisma.TransactionClient) {
    this.client = client;
  }

  async lockLoginState(login: string): Promise<void> {
    const scope = `login:${normalizeLoginIdentifier(login)}`;
    await this.client.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${scope}, 0))::text`;
  }

  async lockInitialUserProvisioning(): Promise<void> {
    await this.client.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('access:initial-administrator', 0))::text`;
  }

  async findUserByLogin(login: string): Promise<UserRecord | null> {
    const normalized = normalizeLoginIdentifier(login);
    const row = await this.client.user.findUnique({
      where: { login: normalized },
      include: { profiles: true },
    });
    return row ? mapUserRow(row) : null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    const row = await this.client.user.findUnique({
      where: { id },
      include: { profiles: true },
    });
    return row ? mapUserRow(row) : null;
  }

  async listUsers(filter?: UserFilter, pagination: Pagination = DEFAULT_PAGINATION): Promise<readonly UserRecord[]> {
    const rows = await this.client.user.findMany({
      where: this.buildFilter(filter),
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
      include: { profiles: true },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => mapUserRow(row));
  }

  async createUser(record: UserRecord): Promise<UserRecord> {
    const assignedAt = new Date(record.createdAt);
    const created = await this.client.user.create({
      data: {
        id: record.id,
        login: record.login,
        displayName: record.displayName,
        passwordHash: record.passwordHash,
        status: record.status,
        version: record.version,
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt),
        deactivatedAt: record.deactivatedAt ? new Date(record.deactivatedAt) : null,
        profiles: {
          create: record.profiles.map((profile) => ({
            profile,
            assignedAt,
          })),
        },
      },
      include: { profiles: true },
    });
    return mapUserRow(created);
  }

  async updateUser(record: UserRecord, expectedVersion: number): Promise<UserRecord | null> {
    const tx = this.client;
    const updatedCount = await tx.user.updateMany({
      where: { id: record.id, version: expectedVersion },
      data: {
        displayName: record.displayName,
        status: record.status,
        version: record.version,
        updatedAt: new Date(record.updatedAt),
        deactivatedAt: record.deactivatedAt ? new Date(record.deactivatedAt) : null,
      },
    });
    if (updatedCount.count === 0) {
      return null;
    }

    await tx.userProfileAssignment.deleteMany({
      where: { userId: record.id },
    });

    const assignedAt = new Date(record.updatedAt);
    for (const profile of record.profiles) {
      await tx.userProfileAssignment.create({
        data: {
          userId: record.id,
          profile,
          assignedAt,
        },
      });
    }

    const fresh = await tx.user.findUnique({
      where: { id: record.id },
      include: { profiles: true },
    });
    return fresh ? mapUserRow(fresh) : null;
  }

  async createSession(session: SessionRecord): Promise<SessionRecord> {
    await this.client.session.create({
      data: {
        id: session.id,
        userId: session.userId,
        tokenHash: session.tokenHash,
        issuedAt: new Date(session.issuedAt),
        lastActivityAt: new Date(session.lastActivityAt),
        idleExpiresAt: new Date(session.idleExpiresAt),
        revokedAt: session.revokedAt ? new Date(session.revokedAt) : null,
      },
    });
    return session;
  }

  async findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const row = await this.client.session.findUnique({
      where: { tokenHash },
    });
    if (!row) return null;
    return {
      id: row.id,
      userId: row.userId,
      tokenHash: row.tokenHash,
      issuedAt: row.issuedAt.toISOString(),
      lastActivityAt: row.lastActivityAt.toISOString(),
      idleExpiresAt: row.idleExpiresAt.toISOString(),
      revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    };
  }

  async updateSessionActivity(
    sessionId: string,
    lastActivityAt: string,
    idleExpiresAt: string,
  ): Promise<void> {
    await this.client.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: {
        lastActivityAt: new Date(lastActivityAt),
        idleExpiresAt: new Date(idleExpiresAt),
      },
    });
  }

  async revokeSessionById(sessionId: string, revokedAt: string): Promise<void> {
    await this.client.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(revokedAt) },
    });
  }

  async revokeAllUserSessions(userId: string, revokedAt: string): Promise<void> {
    await this.client.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(revokedAt) },
    });
  }

  async getLoginAttemptState(login: string): Promise<LoginAttemptStateRecord | null> {
    const normalized = normalizeLoginIdentifier(login);
    const row = await this.client.loginAttemptState.findUnique({
      where: { login: normalized },
    });
    if (!row) return null;
    return {
      login: row.login,
      failedAttempts: row.failedAttempts,
      lockedUntil: row.lockedUntil ? row.lockedUntil.toISOString() : null,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async saveLoginAttemptState(state: LoginAttemptStateRecord): Promise<void> {
    const normalized = normalizeLoginIdentifier(state.login);
    await this.client.loginAttemptState.upsert({
      where: { login: normalized },
      create: {
        login: normalized,
        failedAttempts: state.failedAttempts,
        lockedUntil: state.lockedUntil ? new Date(state.lockedUntil) : null,
        updatedAt: new Date(state.updatedAt),
      },
      update: {
        failedAttempts: state.failedAttempts,
        lockedUntil: state.lockedUntil ? new Date(state.lockedUntil) : null,
        updatedAt: new Date(state.updatedAt),
      },
    });
  }

  async clearLoginAttemptState(login: string): Promise<void> {
    const normalized = normalizeLoginIdentifier(login);
    await this.client.loginAttemptState.deleteMany({
      where: { login: normalized },
    });
  }
  async countUsers(filter?: UserFilter): Promise<number> {
    return this.client.user.count({ where: this.buildFilter(filter) });
  }

  private buildFilter(filter?: UserFilter) {
    return {
        ...(filter?.status ? { status: filter.status } : {}),
        ...(filter?.profile
          ? { profiles: { some: { profile: filter.profile } } }
          : {}),

    };
  }
}
