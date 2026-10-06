import { afterAll, beforeAll, beforeEach, expect } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { readConfig } from '../../src/core/infra/config.js';
import { createRuntime } from '../../src/runtime.js';
import type { UserDto } from '@erp/contracts/access-api';
import type { Role } from '@erp/contracts/access';
import type { Principal } from '../../src/features/access/application/ports.js';
import { integrationEnvironment } from './integration-environment.js';
import { initialInstitutes } from '../../src/features/projects/domain/initial-institutes.js';
import { initialSocialOptions } from '../../src/features/social-forms/domain/initial-social-options.js';

export function setupIntegrationFixture() {
  const { databaseUrl, redisUrl } = integrationEnvironment();
  const config = readConfig({
    NODE_ENV: 'test',
    APP_ORIGIN: 'http://localhost:5173',
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
    JWT_SECRET_BASE64: randomBytes(32).toString('base64'),
    OPERATION_HMAC_CURRENT_KEY_ID: 'v1',
    OPERATION_HMAC_KEYS_JSON: JSON.stringify({
      v1: randomBytes(32).toString('base64'),
    }),
    SOCIAL_FORM_CURRENT_KEY_ID: 'v1',
    SOCIAL_FORM_KEYS_JSON: JSON.stringify({
      v1: randomBytes(32).toString('base64'),
    }),
    BCRYPT_COST: '10',
    COOKIE_SECURE: 'false',
    REDIS_KEY_PREFIX: `erp-test:${randomUUID()}:`,
    LOGIN_IP_MAX_ATTEMPTS: '500',
  });
  const initialPassword = 'synthetic-initial-password';
  const password = 'synthetic-updated-password';
  let runtime: Awaited<ReturnType<typeof createRuntime>>;
  let admin: UserDto;
  let adminCookie: string;
  const headers = (cookie?: string, key = randomUUID()) => ({
    origin: config.APP_ORIGIN,
    'x-erp-request': '1',
    'content-type': 'application/json',
    'idempotency-key': key,
    ...(cookie ? { cookie } : {}),
  });
  async function login(loginName: string, loginPassword = password) {
    const response = await runtime.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: headers(),
      payload: { login: loginName, password: loginPassword },
    });
    expect(response.statusCode, response.body).toBe(200);
    const cookie = response.cookies[0];
    if (!cookie) throw new Error('Expected session cookie');
    return {
      cookie: `${cookie.name}=${cookie.value}`,
      response,
      token: cookie.value,
    };
  }
  async function createUser(
    loginName: string,
    roles: Role[] = ['SOCIAL_ASSISTANCE'],
  ) {
    const response = await runtime.app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: headers(adminCookie),
      payload: {
        login: loginName,
        displayName: `Synthetic ${loginName}`,
        initialPassword,
        roleCodes: roles,
      },
    });
    expect(response.statusCode, response.body).toBe(201);
    return response.json<{ data: UserDto }>().data;
  }
  async function changePassword(user: UserDto, cookie: string) {
    const response = await runtime.app.inject({
      method: 'PUT',
      url: '/api/v1/auth/password',
      headers: headers(cookie),
      payload: {
        expectedRevision: user.revision,
        currentPassword: initialPassword,
        newPassword: password,
      },
    });
    expect(response.statusCode, response.body).toBe(200);
    return response.json<{ data: UserDto }>().data;
  }
  async function operator(loginName: string, roles: Role[]) {
    let user = await createUser(loginName, roles);
    user = await changePassword(
      user,
      (await login(loginName, initialPassword)).cookie,
    );
    return { user, ...(await login(loginName)) };
  }
  async function currentAdmin(): Promise<Principal> {
    return runtime.access.authenticate(
      adminCookie.slice(adminCookie.indexOf('=') + 1),
    );
  }
  async function cleanRedis() {
    const keys: string[] = [];
    for await (const batch of runtime.redis.scanIterator({
      MATCH: `${config.REDIS_KEY_PREFIX}*`,
      COUNT: 100,
    }))
      keys.push(...batch);
    if (keys.length) await runtime.redis.del(keys);
  }
  beforeAll(async () => {
    runtime = await createRuntime(config);
  });
  beforeEach(async () => {
    await runtime.database.$executeRawUnsafe(
      'TRUNCATE "DataQualityIssue", "SizeProfile", "FamilyMembership", "Person", "Family", "AuditEntry", "OperationRecord", "RoleAssignment", "FeatureDecision", "UserAccount", "Role" CASCADE',
    );
    await runtime.database.serviceType.deleteMany();
    await runtime.database.socialFormOption.deleteMany();
    await runtime.database.socialFormOption.createMany({
      data: initialSocialOptions.map((option) => ({
        ...option,
        id: randomUUID(),
      })),
    });
    for (const institute of initialInstitutes)
      await runtime.database.institute.update({
        where: { code: institute.code },
        data: { name: institute.name, active: true, revision: 1 },
      });
    await cleanRedis();
    admin = await runtime.accounts.bootstrap(
      {
        login: 'synthetic.admin',
        displayName: 'Synthetic Administrator',
        initialPassword,
        roleCodes: ['ADMINISTRATOR'],
      },
      await runtime.access.hash(initialPassword),
    );
    admin = await changePassword(
      admin,
      (await login(admin.login, initialPassword)).cookie,
    );
    adminCookie = (await login(admin.login)).cookie;
  });
  afterAll(async () => {
    if (runtime) {
      if (runtime.redis.isOpen) await cleanRedis();
      await runtime.app.close();
    }
  });

  return {
    config,
    initialPassword,
    password,
    headers,
    login,
    createUser,
    changePassword,
    operator,
    currentAdmin,
    get runtime() {
      return runtime;
    },
    get admin() {
      return admin;
    },
    get adminCookie() {
      return adminCookie;
    },
  };
}
