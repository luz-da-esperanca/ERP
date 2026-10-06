import { createHmac, randomUUID } from 'node:crypto';
import { passwordSchema, sessionDtoSchema } from '@erp/contracts/access-api';
import type { ApiConfig } from '../../../core/infra/config.js';
import type { createRuntime } from '../../../runtime.js';
import { civilDateAt } from '../../projects/domain/activity-rules.js';
import { createSeedClient } from './seed-client.js';
import { seedShowcaseData } from './showcase-data.js';
import {
  assertShowcaseEnvironment,
  ShowcaseSeedError,
} from './seed-environment.js';

type Runtime = Awaited<ReturnType<typeof createRuntime>>;
const demoAccounts = [
  {
    login: 'demo.admin',
    displayName: 'Demonstração — Administração',
    roleCodes: ['ADMINISTRATOR'],
  },
  {
    login: 'demo.coordination',
    displayName: 'Demonstração — Coordenação',
    roleCodes: ['COORDINATION'],
  },
  {
    login: 'demo.social',
    displayName: 'Demonstração — Assistência Social',
    roleCodes: ['SOCIAL_ASSISTANCE'],
  },
  {
    login: 'demo.activity',
    displayName: 'Demonstração — Responsável por Atividade',
    roleCodes: ['ACTIVITY_MANAGER'],
  },
] as const;

export async function seedShowcase(
  runtime: Runtime,
  config: ApiConfig,
  password: string,
) {
  assertShowcaseEnvironment(config);
  passwordSchema.parse(password);
  const initialPassword = (login: string) =>
    `Initial-${createHmac('sha256', password).update(login).digest('base64url')}`;
  const request = async (
    method: 'POST' | 'PUT',
    url: string,
    payload?: object,
    cookie?: string,
    key?: string,
  ) => {
    const response = await runtime.app.inject({
      method,
      url: `/api/v1${url}`,
      payload,
      headers: {
        origin: config.APP_ORIGIN,
        'x-erp-request': '1',
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
        ...(key ? { 'idempotency-key': key } : {}),
      },
    });
    if (response.statusCode >= 400)
      throw new ShowcaseSeedError(
        `Showcase request failed: ${method} ${url} (${response.statusCode})`,
      );
    return response;
  };
  let existing = await runtime.accounts.findByLogin(demoAccounts[0].login);
  if (!existing) {
    const occupied =
      (await runtime.database.userAccount.count()) +
      (await runtime.database.family.count()) +
      (await runtime.database.person.count()) +
      (await runtime.database.project.count());
    if (occupied)
      throw new ShowcaseSeedError(
        'Showcase seed requires an empty database or its existing demo accounts',
      );
    const account = demoAccounts[0];
    await runtime.accounts.bootstrap(
      {
        ...account,
        roleCodes: [...account.roleCodes],
        initialPassword: initialPassword(account.login),
      },
      await runtime.access.hash(initialPassword(account.login)),
    );
    existing = await runtime.accounts.findByLogin(account.login);
  }
  if (existing?.user.displayName !== demoAccounts[0].displayName)
    throw new ShowcaseSeedError(
      'Existing demo administrator does not belong to this showcase',
    );
  let adminCookie: string | undefined;
  const sessions = new Map<string, { cookie: string; userId: string }>();
  try {
    for (const account of demoAccounts) {
      let current = await runtime.accounts.findByLogin(account.login);
      if (!current) {
        await request(
          'POST',
          '/users',
          { ...account, initialPassword: initialPassword(account.login) },
          adminCookie,
          randomUUID(),
        );
        current = await runtime.accounts.findByLogin(account.login);
      }
      if (!current) throw new ShowcaseSeedError('Showcase account is missing');
      const login = async (loginPassword: string) => {
        const response = await request('POST', '/auth/login', {
          login: account.login,
          password: loginPassword,
        });
        const cookie = response.cookies[0];
        if (!cookie)
          throw new ShowcaseSeedError('Showcase login returned no session');
        return {
          cookie: `${cookie.name}=${cookie.value}`,
          user: sessionDtoSchema.parse(response.json().data).user,
        };
      };
      if (current.user.mustChangePassword) {
        const first = await login(initialPassword(account.login));
        await request(
          'PUT',
          '/auth/password',
          {
            expectedRevision: first.user.revision,
            currentPassword: initialPassword(account.login),
            newPassword: password,
          },
          first.cookie,
        );
      }
      const signedIn = await login(password);
      sessions.set(account.login, {
        cookie: signedIn.cookie,
        userId: signedIn.user.id,
      });
      if (account.login === 'demo.admin') adminCookie = signedIn.cookie;
    }
    const coordinator = sessions.get('demo.coordination')!;
    const bootstrapDate = civilDateAt(
      existing.user.createdAt,
      config.APP_TIMEZONE,
    );
    const referenceDate = new Date(Date.parse(bootstrapDate) - 86400000)
      .toISOString()
      .slice(0, 10);
    const data = await seedShowcaseData(
      createSeedClient(runtime, config, coordinator.cookie, coordinator.userId),
      referenceDate,
      config.APP_TIMEZONE,
      sessions.get('demo.activity')!.userId,
    );
    return { logins: demoAccounts.map((account) => account.login), ...data };
  } finally {
    for (const session of sessions.values()) {
      try {
        await request('POST', '/auth/logout', {}, session.cookie);
      } catch {
        // Cleanup cannot replace an already committed outcome; sessions also expire normally.
      }
    }
  }
}
