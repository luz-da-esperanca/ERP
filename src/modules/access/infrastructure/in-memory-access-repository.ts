import { DEFAULT_PAGINATION, type Pagination } from '../../shared/pagination.ts';
import type { UserFilter } from '../application/access-service.ts';
import type { AccessRepositoryPort } from '../application/access-service.ts';
import {
  normalizeLoginIdentifier,
  type AccessProfile,
  type LoginAttemptStateRecord,
  type SessionRecord,
  type UserRecord,
  type UserStatus,
} from '../domain/access-types.ts';
import { hashPassword } from './password-hasher.ts';

export interface SeedUserInput {
  readonly id: string;
  readonly loginIdentifier: string;
  readonly displayName: string;
  readonly password: string;
  readonly profiles: readonly AccessProfile[];
  readonly status?: UserStatus;
}

export class InMemoryAccessRepository implements AccessRepositoryPort {
  async lockInitialUserProvisioning(): Promise<void> {
    // The shared in-memory transaction runner serializes initial provisioning.
  }
  async lockLoginState(): Promise<void> {
    // The in-memory transaction runner serializes access to its checkpointed state.
  }
  private readonly usersById = new Map<string, UserRecord>();
  private readonly sessionsById = new Map<string, SessionRecord>();
  private readonly loginAttemptsByLogin = new Map<string, LoginAttemptStateRecord>();

  constructor(seedUsers: readonly SeedUserInput[] = []) {
    const initialIso = '2026-01-01T00:00:00.000Z';
    for (const seed of seedUsers) {
      const normalizedLogin = normalizeLoginIdentifier(seed.loginIdentifier);
      const status = seed.status ?? 'ACTIVE';
      this.usersById.set(seed.id, {
        id: seed.id,
        login: normalizedLogin,
        displayName: seed.displayName,
        passwordHash: hashPassword(seed.password),
        status,
        profiles: [...seed.profiles],
        version: 1,
        createdAt: initialIso,
        updatedAt: initialIso,
        deactivatedAt: status === 'DEACTIVATED' ? initialIso : null,
      });
    }
  }

  async findUserByLogin(login: string): Promise<UserRecord | null> {
    const normalized = normalizeLoginIdentifier(login);
    for (const user of this.usersById.values()) {
      if (user.login === normalized) {
        return user;
      }
    }
    return null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    return this.usersById.get(id) ?? null;
  }

  async listUsers(filter?: UserFilter, pagination: Pagination = DEFAULT_PAGINATION): Promise<readonly UserRecord[]> {
    const offset = (pagination.page - 1) * pagination.pageSize;
    return this.matchingUsers(filter).slice(offset, offset + pagination.pageSize);
  }

  async countUsers(filter?: UserFilter): Promise<number> {
    return this.matchingUsers(filter).length;
  }

  private matchingUsers(filter?: UserFilter): readonly UserRecord[] {
    const all = [...this.usersById.values()];
    return all
      .filter((user) => {
        if (filter?.status && user.status !== filter.status) return false;
        if (filter?.profile && !user.profiles.includes(filter.profile)) return false;
        return true;
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));
  }

  async createUser(record: UserRecord): Promise<UserRecord> {
    this.usersById.set(record.id, record);
    return record;
  }

  async updateUser(record: UserRecord, expectedVersion: number): Promise<UserRecord | null> {
    const existing = this.usersById.get(record.id);
    if (!existing || existing.version !== expectedVersion) {
      return null;
    }
    this.usersById.set(record.id, record);
    return record;
  }

  async createSession(session: SessionRecord): Promise<SessionRecord> {
    this.sessionsById.set(session.id, session);
    return session;
  }

  async findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    for (const session of this.sessionsById.values()) {
      if (session.tokenHash === tokenHash) {
        return session;
      }
    }
    return null;
  }

  async updateSessionActivity(
    sessionId: string,
    lastActivityAt: string,
    idleExpiresAt: string,
  ): Promise<void> {
    const existing = this.sessionsById.get(sessionId);
    if (!existing) return;
    this.sessionsById.set(sessionId, {
      ...existing,
      lastActivityAt,
      idleExpiresAt,
    });
  }

  async revokeSessionById(sessionId: string, revokedAt: string): Promise<void> {
    const existing = this.sessionsById.get(sessionId);
    if (!existing) return;
    this.sessionsById.set(sessionId, {
      ...existing,
      revokedAt,
    });
  }

  async revokeAllUserSessions(userId: string, revokedAt: string): Promise<void> {
    for (const [id, session] of this.sessionsById.entries()) {
      if (session.userId === userId && session.revokedAt === null) {
        this.sessionsById.set(id, {
          ...session,
          revokedAt,
        });
      }
    }
  }

  async getLoginAttemptState(login: string): Promise<LoginAttemptStateRecord | null> {
    return this.loginAttemptsByLogin.get(normalizeLoginIdentifier(login)) ?? null;
  }

  async saveLoginAttemptState(state: LoginAttemptStateRecord): Promise<void> {
    this.loginAttemptsByLogin.set(normalizeLoginIdentifier(state.login), state);
  }

  async clearLoginAttemptState(login: string): Promise<void> {
    this.loginAttemptsByLogin.delete(normalizeLoginIdentifier(login));
  }
  checkpoint(): () => void {
    const usersById = structuredClone(this.usersById);
    const sessionsById = structuredClone(this.sessionsById);
    const loginAttemptsByLogin = structuredClone(this.loginAttemptsByLogin);
    return () => {
      this.usersById.clear();
      for (const [key, value] of usersById) this.usersById.set(key, value);
      this.sessionsById.clear();
      for (const [key, value] of sessionsById) this.sessionsById.set(key, value);
      this.loginAttemptsByLogin.clear();
      for (const [key, value] of loginAttemptsByLogin) this.loginAttemptsByLogin.set(key, value);
    };
  }
}
