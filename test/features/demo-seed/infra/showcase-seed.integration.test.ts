import { beforeEach, describe, expect, it } from 'vitest';
import { setupIntegrationFixture } from '../../../support/integration-fixture.js';
import { seedShowcase } from '../../../../src/features/demo-seed/infra/showcase-seed.js';

describe('Synthetic showcase seed', () => {
  const fixture = setupIntegrationFixture();
  const password = 'synthetic-showcase-password';

  beforeEach(async () => {
    await fixture.runtime.database.$executeRawUnsafe(
      'TRUNCATE "UserAccount", "AuditEntry", "OperationRecord" CASCADE',
    );
  });

  it('creates usable individual accounts with the four separate roles', async () => {
    await seedShowcase(fixture.runtime, fixture.config, password);
    const roles = {
      'demo.admin': 'ADMINISTRATOR',
      'demo.coordination': 'COORDINATION',
      'demo.social': 'SOCIAL_ASSISTANCE',
      'demo.activity': 'ACTIVITY_MANAGER',
    };
    for (const [login, role] of Object.entries(roles)) {
      const { response } = await fixture.login(login, password);
      expect(response.json().data.user).toMatchObject({
        login,
        roleCodes: [role],
        mustChangePassword: false,
        active: true,
      });
      expect(response.body).not.toContain(password);
      expect(response.body).not.toContain('passwordHash');
    }
    const admin = await fixture.login('demo.admin', password);
    const users = await fixture.runtime.app.inject({
      method: 'GET',
      url: '/api/v1/users',
      headers: fixture.headers(admin.cookie),
    });
    expect(users.json().pagination.total).toBe(4);
    const denied = await fixture.runtime.app.inject({
      method: 'GET',
      url: '/api/v1/families',
      headers: fixture.headers(admin.cookie),
    });
    expect(denied.statusCode).toBe(403);
  });

  it('provides families, versioned forms and eligible, ineligible and unknown attendance scenarios', async () => {
    const showcase = await seedShowcase(
      fixture.runtime,
      fixture.config,
      password,
    );
    const coordinator = await fixture.login('demo.coordination', password);
    const get = async (url: string) => {
      const response = await fixture.runtime.app.inject({
        method: 'GET',
        url: `/api/v1${url}`,
        headers: fixture.headers(coordinator.cookie),
      });
      expect(response.statusCode, response.body).toBe(200);
      return response.json();
    };
    expect((await get('/families')).pagination.total).toBe(4);
    expect((await get('/people')).pagination.total).toBe(8);
    expect((await get('/projects')).pagination.total).toBe(2);
    expect((await get('/activities')).pagination.total).toBe(3);
    const families = (await get('/families')).data;
    const expectedStatuses = ['ELIGIBLE', 'INELIGIBLE', 'PENDING', 'PENDING'];
    for (const [index, name] of [
      'Aurora',
      'Girassol',
      'Horizonte',
      'Jacarandá',
    ].entries()) {
      const family = families.find(
        (row: { referenceName: string }) =>
          row.referenceName === `${name} (demo)`,
      );
      expect(family, name).toBeDefined();
      const preview = await get(
        `/families/${family.id}/eligibility-preview?referenceDate=${showcase.referenceDate}`,
      );
      expect(preview.data.status, name).toBe(expectedStatuses[index]);
      if (index === 0) {
        expect(
          (await get(`/families/${family.id}/social-forms`)).data,
        ).toHaveLength(2);
        expect(
          preview.data.evidences.some(
            (row: { presenceCount: number }) => row.presenceCount === 3,
          ),
        ).toBe(true);
      }
      if (index === 1)
        expect(preview.data.evidences).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              sessionCount: 3,
              presenceCount: 1,
              absenceCount: 2,
            }),
          ]),
        );
      if (index === 2)
        expect(preview.data.evidences[0]).toMatchObject({
          presenceCount: 0,
          absenceCount: 0,
          unrecordedCount: 3,
        });
    }
    expect(
      (await get('/data-quality-issues?kind=MISSING_DATA&status=OPEN'))
        .pagination.total,
    ).toBeGreaterThan(0);
    expect(
      (await get('/data-quality-issues?kind=POSSIBLE_DUPLICATE&status=OPEN'))
        .pagination.total,
    ).toBeGreaterThan(0);
    const report = await get(
      `/reports/eligibility?referenceDate=${showcase.referenceDate}`,
    );
    expect(report.data.totals).toMatchObject({
      ELIGIBLE: 1,
      INELIGIBLE: 1,
      PENDING: 2,
    });
  }, 30000);

  it('can run again without duplicating data or overwriting manual changes', async () => {
    const first = await seedShowcase(fixture.runtime, fixture.config, password);
    const coordinator = await fixture.login('demo.coordination', password);
    const app = fixture.runtime.app;
    const family = await app.inject({
      method: 'GET',
      url: `/api/v1/families/${first.familyIds[0]}`,
      headers: fixture.headers(coordinator.cookie),
    });
    const changed = await app.inject({
      method: 'PATCH',
      url: `/api/v1/families/${first.familyIds[0]}`,
      headers: fixture.headers(coordinator.cookie),
      payload: {
        expectedRevision: family.json().data.family.revision,
        neighborhood: 'Alteração manual fictícia',
      },
    });
    expect(changed.statusCode, changed.body).toBe(200);
    const extra = await app.inject({
      method: 'POST',
      url: '/api/v1/families',
      headers: fixture.headers(coordinator.cookie),
      payload: { referenceName: 'Teste manual independente' },
    });
    expect(extra.statusCode, extra.body).toBe(201);
    const audit = async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/audit-entries?entityType=Family&entityId=${first.familyIds[0]}`,
        headers: fixture.headers(coordinator.cookie),
      });
      expect(response.statusCode, response.body).toBe(200);
      return response.json().pagination.total;
    };
    const before = await audit();
    const second = await seedShowcase(
      fixture.runtime,
      fixture.config,
      password,
    );
    expect(second).toEqual(first);
    expect(await audit()).toBe(before);
    const after = await app.inject({
      method: 'GET',
      url: `/api/v1/families/${first.familyIds[0]}`,
      headers: fixture.headers(coordinator.cookie),
    });
    expect(after.json().data.family.neighborhood).toBe(
      'Alteração manual fictícia',
    );
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/api/v1/families',
          headers: fixture.headers(coordinator.cookie),
        })
      ).json().pagination.total,
    ).toBe(5);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/api/v1/people',
          headers: fixture.headers(coordinator.cookie),
        })
      ).json().pagination.total,
    ).toBe(8);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/api/v1/families/${first.familyIds[0]}/social-forms`,
          headers: fixture.headers(coordinator.cookie),
        })
      ).json().data,
    ).toHaveLength(2);
  }, 30000);

  it('resumes after a failed transaction without duplicating completed steps', async () => {
    const database = fixture.runtime.database;
    await database.$executeRawUnsafe(
      `CREATE FUNCTION fail_showcase_form() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."entityType" = 'SocialForm' THEN RAISE EXCEPTION 'Synthetic seed failure'; END IF; RETURN NEW; END $$`,
    );
    await database.$executeRawUnsafe(
      `CREATE TRIGGER fail_showcase_form BEFORE INSERT ON "AuditEntry" FOR EACH ROW EXECUTE FUNCTION fail_showcase_form()`,
    );
    try {
      await expect(
        seedShowcase(fixture.runtime, fixture.config, password),
      ).rejects.toThrow('social:form:0');
    } finally {
      await database.$executeRawUnsafe(
        'DROP TRIGGER fail_showcase_form ON "AuditEntry"',
      );
      await database.$executeRawUnsafe('DROP FUNCTION fail_showcase_form()');
    }
    const result = await seedShowcase(
      fixture.runtime,
      fixture.config,
      password,
    );
    const coordinator = await fixture.login('demo.coordination', password);
    const app = fixture.runtime.app;
    const families = await app.inject({
      method: 'GET',
      url: '/api/v1/families',
      headers: fixture.headers(coordinator.cookie),
    });
    expect(families.json().pagination.total).toBe(4);
    const forms = await app.inject({
      method: 'GET',
      url: `/api/v1/families/${result.familyIds[0]}/social-forms`,
      headers: fixture.headers(coordinator.cookie),
    });
    expect(forms.json().data).toHaveLength(2);
    const sessions = await app.inject({
      method: 'GET',
      url: `/api/v1/activities/${result.activityIds[0]}/sessions`,
      headers: fixture.headers(coordinator.cookie),
    });
    expect(sessions.json().pagination.total).toBe(4);
  }, 30000);

  it('refuses an existing application database that was not initialized by the showcase', async () => {
    const user = await fixture.runtime.accounts.bootstrap(
      {
        login: 'existing.admin',
        displayName: 'Existing administrator',
        initialPassword: fixture.initialPassword,
        roleCodes: ['ADMINISTRATOR'],
      },
      await fixture.runtime.access.hash(fixture.initialPassword),
    );
    await fixture.changePassword(
      user,
      (await fixture.login(user.login, fixture.initialPassword)).cookie,
    );
    await expect(
      seedShowcase(fixture.runtime, fixture.config, password),
    ).rejects.toThrow('empty database');
    const admin = await fixture.login(user.login);
    const response = await fixture.runtime.app.inject({
      method: 'GET',
      url: '/api/v1/users',
      headers: fixture.headers(admin.cookie),
    });
    expect(response.json().data).toHaveLength(1);
    expect(response.json().data[0].login).toBe('existing.admin');
  });
});
