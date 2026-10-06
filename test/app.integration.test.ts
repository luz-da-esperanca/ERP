import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { DataModeGuard } from '../src/core/application/data-mode.js';
import { PrismaFeatureDecisions } from '../src/core/infra/prisma-feature-decisions.js';
import { AuditService } from '../src/features/audit/application/audit-service.js';
import { PrismaAuditReader } from '../src/features/audit/infra/audit-store.js';
import { createRuntime } from '../src/runtime.js';
import { createDatabase } from '../src/core/infra/database.js';
import { setupIntegrationFixture } from './support/integration-fixture.js';
const fixture = setupIntegrationFixture();
describe('Application data mode and dependency errors', () => {
  it('returns a dependency error when PostgreSQL cannot be reached', async () => {
    const { config, runtime, adminCookie } = fixture;
    const unavailableUrl = new URL(config.DATABASE_URL);
    unavailableUrl.port = '1';
    const database = createDatabase(unavailableUrl.toString());
    const app = createApp(config, {
      access: runtime.access,
      accounts: runtime.accounts,
      registration: runtime.registration,
      projects: runtime.projects,
      attendance: runtime.attendance,
      membershipReconciliation: runtime.membershipReconciliation,
      socialForms: runtime.socialForms,
      eligibility: runtime.eligibility,
      identityMerges: runtime.identityMerges,
      reports: runtime.reports,
      audit: new AuditService(new PrismaAuditReader(database)),
      dataMode: new DataModeGuard(
        config.DATA_MODE,
        new PrismaFeatureDecisions(database),
      ),
    });
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/audit-entries?entityType=UserAccount',
        headers: { cookie: adminCookie },
      });
      expect(response.statusCode, response.body).toBe(503);
      expect(response.json().error.code).toBe('DEPENDENCY_UNAVAILABLE');
    } finally {
      await app.close();
      await database.$disconnect();
    }
  });
  it('fails authenticated requests and logout closed when Redis is unavailable', async () => {
    const { runtime, adminCookie, headers, admin, password } = fixture;
    runtime.redis.destroy();
    try {
      expect(
        (
          await runtime.app.inject({
            method: 'GET',
            url: '/api/v1/auth/session',
            headers: { cookie: adminCookie },
          })
        ).statusCode,
      ).toBe(503);
      expect(
        (
          await runtime.app.inject({
            method: 'POST',
            url: '/api/v1/auth/logout',
            headers: headers(adminCookie),
            payload: {},
          })
        ).statusCode,
      ).toBe(503);
      expect(
        (
          await runtime.app.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            headers: headers(),
            payload: { login: admin.login, password },
          })
        ).statusCode,
      ).toBe(503);
      expect(
        (await runtime.app.inject({ method: 'GET', url: '/api/v1/health' }))
          .statusCode,
      ).toBe(200);
    } finally {
      await runtime.redis.connect();
    }
  });
  it('refuses real data without a recorded institutional decision', async () => {
    const { runtime, config } = fixture;
    await expect(
      createRuntime({ ...config, DATA_MODE: 'REAL' }),
    ).rejects.toThrow('API initialization failed');
    const app = createApp(config, {
      access: runtime.access,
      accounts: runtime.accounts,
      registration: runtime.registration,
      projects: runtime.projects,
      attendance: runtime.attendance,
      membershipReconciliation: runtime.membershipReconciliation,
      socialForms: runtime.socialForms,
      eligibility: runtime.eligibility,
      identityMerges: runtime.identityMerges,
      reports: runtime.reports,
      audit: new AuditService(new PrismaAuditReader(runtime.database)),
      dataMode: new DataModeGuard(
        'REAL',
        new PrismaFeatureDecisions(runtime.database),
      ),
    });
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/session',
      });
      expect(response.statusCode).toBe(422);
      expect(response.json().error.code).toBe('FEATURE_NOT_ENABLED');
    } finally {
      await app.close();
    }
  });
});
