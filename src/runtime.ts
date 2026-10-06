import { MembershipReconciliationService } from './features/registration/application/membership-reconciliation-service.js';
import { PrismaMembershipReconciliation } from './features/registration/infra/prisma-membership-reconciliation.js';
import { AttendanceService } from './features/attendance/application/attendance-service.js';
import { PrismaAttendance } from './features/attendance/infra/prisma-attendance.js';
import { EligibilityService } from './features/eligibility/application/eligibility-service.js';
import { PrismaEligibility } from './features/eligibility/infra/prisma-eligibility.js';
import { IdentityMergeService } from './features/registration/application/identity-merge-service.js';
import { PrismaIdentityMerge } from './features/registration/infra/prisma-identity-merge.js';
import type { ApiConfig } from './core/infra/config.js';
import { randomUUID } from 'node:crypto';
import { createDatabase, type Database } from './core/infra/database.js';
import { DataModeGuard } from './core/application/data-mode.js';
import { PrismaFeatureDecisions } from './core/infra/prisma-feature-decisions.js';
import { createOperationFingerprints } from './core/infra/operation-fingerprint.js';
import { AccountsService } from './features/access/application/accounts-service.js';
import {
  PrismaAccountAudit,
  PrismaAuditReader,
} from './features/audit/infra/audit-store.js';
import { AuditService } from './features/audit/application/audit-service.js';
import { PrismaAccounts } from './features/access/infra/prisma-accounts.js';
import {
  createRedis,
  RedisSessions,
} from './features/access/infra/redis-sessions.js';
import { createPasswordHasher } from './features/access/infra/bcrypt-passwords.js';
import { createTokenSigner } from './features/access/infra/jwt-tokens.js';
import { AccessService } from './features/access/application/access-service.js';
import { createApp } from './app.js';
import { PrismaRegistration } from './features/registration/infra/prisma-registration.js';
import { RegistrationService } from './features/registration/application/registration-service.js';
import { PrismaProjects } from './features/projects/infra/prisma-projects.js';
import { ProjectsService } from './features/projects/application/projects-service.js';
import { SocialFormsService } from './features/social-forms/application/social-forms-service.js';
import { PrismaSocialForms } from './features/social-forms/infra/prisma-social-forms.js';
import { createSensitivePayloads } from './features/social-forms/infra/sensitive-payloads.js';

export function createAccounts(database: Database, config: ApiConfig) {
  const persistence = new PrismaAccounts(
    database,
    (tx) => new PrismaAccountAudit(tx),
  );
  return new AccountsService(
    persistence,
    persistence,
    createOperationFingerprints(config),
    randomUUID,
  );
}

export async function createRuntime(config: ApiConfig, logging = false) {
  const database = createDatabase(config.DATABASE_URL);
  const redis = createRedis(config.REDIS_URL);
  redis.on('error', () => {
    /* Requests fail closed; connection errors never include credentials in logs. */
  });
  try {
    await database.$connect();
    const dataMode = new DataModeGuard(
      config.DATA_MODE,
      new PrismaFeatureDecisions(database),
    );
    await dataMode.assertEnabled();
    await redis.connect();
    const passwords = await createPasswordHasher(config.BCRYPT_COST);
    const accounts = createAccounts(database, config);
    const sessions = new RedisSessions(redis, config);
    const access = new AccessService(
      accounts,
      sessions,
      passwords,
      createTokenSigner(config),
    );
    const socialForms = new SocialFormsService(
      new PrismaSocialForms(database),
      createOperationFingerprints(config),
      createSensitivePayloads(
        config.SOCIAL_FORM_CURRENT_KEY_ID,
        config.socialFormKeys,
      ),
      () => new Date().toISOString(),
      randomUUID,
      config.DATA_MODE,
    );
    const audit = new AuditService(
      new PrismaAuditReader(database),
      (actor, entry) => socialForms.projectAudit(actor, entry),
    );
    const registrationPersistence = new PrismaRegistration(database);
    const registration = new RegistrationService(
      registrationPersistence,
      registrationPersistence,
      createOperationFingerprints(config),
      () => new Date().toISOString(),
      () =>
        new Intl.DateTimeFormat('en-CA', {
          timeZone: config.APP_TIMEZONE,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date()),
      config.APP_TIMEZONE,
    );
    const projectsPersistence = new PrismaProjects(database);
    const projects = new ProjectsService(
      projectsPersistence,
      projectsPersistence,
      createOperationFingerprints(config),
      () => new Date().toISOString(),
      config.APP_TIMEZONE,
    );
    const attendancePersistence = new PrismaAttendance(database);
    const attendance = new AttendanceService(
      attendancePersistence,
      attendancePersistence,
      createOperationFingerprints(config),
      () => new Date().toISOString(),
      config.APP_TIMEZONE,
    );
    const eligibilityPersistence = new PrismaEligibility(database);
    const eligibility = new EligibilityService(
      eligibilityPersistence,
      eligibilityPersistence,
      createOperationFingerprints(config),
      () => new Date().toISOString(),
      config.APP_TIMEZONE,
    );
    const mergePersistence = new PrismaIdentityMerge(database);
    const identityMerges = new IdentityMergeService(
      mergePersistence,
      mergePersistence,
      createOperationFingerprints(config),
      () => new Date().toISOString(),
      config.APP_TIMEZONE,
    );
    const reconciliationPersistence = new PrismaMembershipReconciliation(
      database,
    );
    const membershipReconciliation = new MembershipReconciliationService(
      reconciliationPersistence,
      reconciliationPersistence,
      createOperationFingerprints(config),
      () => new Date().toISOString(),
      config.APP_TIMEZONE,
    );
    const app = createApp(
      config,
      {
        access,
        accounts,
        audit,
        dataMode,
        registration,
        projects,
        attendance,
        membershipReconciliation,
        socialForms,
        eligibility,
        identityMerges,
      },
      logging,
    );
    app.addHook('onClose', async () => {
      if (redis.isOpen) await redis.close();
      await database.$disconnect();
    });
    return {
      app,
      database,
      redis,
      accounts,
      access,
      sessions,
      registration,
      projects,
      attendance,
      membershipReconciliation,
      socialForms,
      eligibility,
      identityMerges,
    };
  } catch {
    if (redis.isOpen) redis.destroy();
    await database.$disconnect();
    throw new Error(
      'API initialization failed; check dependencies, migrations and data mode',
    );
  }
}
